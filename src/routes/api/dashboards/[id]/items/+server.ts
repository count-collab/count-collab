import { error, json } from "@sveltejs/kit";
import { z } from "zod";
import { canViewPrivateCounter } from "$lib/server/authorize";
import { getCounter } from "$lib/server/counters";
import { canEditDashboard } from "$lib/server/dashboard-authorize";
import {
  addDashboardItem,
  getDashboardItem,
  relayoutDashboardItems,
  removeDashboardItem,
} from "$lib/server/dashboard-items";
import { getDashboard } from "$lib/server/dashboards";
import { parseAndValidateBody } from "$lib/server/request";
import {
  emitDashboardItemAdded,
  emitDashboardItemRemoved,
} from "$lib/utils/socket";
import {
  addDashboardItemSchema,
  dashboardIdSchema,
  moveDashboardItemSchema,
  resizeDashboardItemSchema,
} from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

async function loadGridColumns(dashboardId: string): Promise<number> {
  const dashboard = await getDashboard(dashboardId);
  if (!dashboard) {
    throw error(404, "Dashboard not found");
  }
  return dashboard.gridColumns;
}

function exceedsGridResponse(gridColumns: number) {
  return json(
    { error: `Item must fit within the dashboard's ${gridColumns} columns` },
    { status: 400 },
  );
}

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const idValidation = dashboardIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid dashboard ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to add items");
  }

  const allowed = await canEditDashboard(session.user.id, params.id);
  if (!allowed) {
    throw error(403, "You don't have permission to edit this dashboard");
  }

  const validation = await parseAndValidateBody(
    request,
    addDashboardItemSchema,
    "Add dashboard item",
  );
  if (!validation.success) {
    return validation.response;
  }

  const { counterId, positionX, positionY, sizeColumns, sizeRows } =
    validation.data;

  const gridColumns = await loadGridColumns(params.id);
  if (positionX + sizeColumns > gridColumns) {
    return exceedsGridResponse(gridColumns);
  }

  const counter = await getCounter(counterId);
  const canViewCounter =
    !!counter &&
    (counter.visibilityMode !== "private" ||
      (await canViewPrivateCounter(session.user.id, counter.id)));
  if (!canViewCounter) {
    throw error(404, "Counter not found");
  }

  const item = await addDashboardItem(
    params.id,
    counterId,
    positionX,
    positionY,
    sizeColumns,
    sizeRows,
  );

  if (!item) {
    throw error(409, "This dashboard has reached its item limit");
  }

  emitDashboardItemAdded(params.id, item.id);

  return json(item, { status: 201 });
};

const patchActionSchema = z.object({
  action: z.enum(["move", "resize"]),
});

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const idValidation = dashboardIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid dashboard ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to modify items");
  }

  const allowed = await canEditDashboard(session.user.id, params.id);
  if (!allowed) {
    throw error(403, "You don't have permission to edit this dashboard");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const actionResult = patchActionSchema.safeParse(body);
  if (!actionResult.success) {
    return json(
      { error: 'Missing or invalid "action" field' },
      { status: 400 },
    );
  }

  const { action } = actionResult.data;

  if (action === "move") {
    const validation = moveDashboardItemSchema.safeParse(body);
    if (!validation.success) {
      return json(
        { errors: validation.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const { itemId, positionX, positionY } = validation.data;
    const gridColumns = await loadGridColumns(params.id);
    const item = await getDashboardItem(params.id, itemId);
    if (!item) {
      throw error(404, "Dashboard item not found");
    }
    if (positionX + item.sizeColumns > gridColumns) {
      return exceedsGridResponse(gridColumns);
    }
    const updatedItems = await relayoutDashboardItems(
      params.id,
      { type: "move", itemId, positionX, positionY },
      gridColumns,
    );
    return json({ items: updatedItems });
  }

  // action === "resize"
  const validation = resizeDashboardItemSchema.safeParse(body);
  if (!validation.success) {
    return json(
      { errors: validation.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { itemId, sizeColumns, sizeRows } = validation.data;
  const gridColumns = await loadGridColumns(params.id);
  if (!(await getDashboardItem(params.id, itemId))) {
    throw error(404, "Dashboard item not found");
  }
  // Relayout shifts the item left if needed, so only the width is bounded here
  if (sizeColumns > gridColumns) {
    return exceedsGridResponse(gridColumns);
  }
  const updatedItems = await relayoutDashboardItems(
    params.id,
    { type: "resize", itemId, sizeColumns, sizeRows },
    gridColumns,
  );
  return json({ items: updatedItems });
};

const deleteItemSchema = z.object({
  itemId: z.number().int().positive(),
});

export const DELETE: RequestHandler = async ({ params, request, locals }) => {
  const idValidation = dashboardIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid dashboard ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to remove items");
  }

  const allowed = await canEditDashboard(session.user.id, params.id);
  if (!allowed) {
    throw error(403, "You don't have permission to edit this dashboard");
  }

  const validation = await parseAndValidateBody(
    request,
    deleteItemSchema,
    "Remove dashboard item",
  );
  if (!validation.success) {
    return validation.response;
  }

  const { itemId } = validation.data;
  const removed = await removeDashboardItem(params.id, itemId);
  if (!removed) {
    throw error(404, "Dashboard item not found");
  }

  emitDashboardItemRemoved(params.id, itemId);

  return json({ success: true });
};
