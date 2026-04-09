import { error, json } from "@sveltejs/kit";
import { z } from "zod";
import { canEditDashboard } from "$lib/server/dashboard-authorize";
import {
  addDashboardItem,
  relayoutDashboardItems,
  removeDashboardItem,
} from "$lib/server/dashboard-items";
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

  const item = await addDashboardItem(
    params.id,
    counterId,
    positionX,
    positionY,
    sizeColumns,
    sizeRows,
  );

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
    const updatedItems = await relayoutDashboardItems(params.id, {
      type: "move",
      itemId,
      positionX,
      positionY,
    });
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
  const updatedItems = await relayoutDashboardItems(params.id, {
    type: "resize",
    itemId,
    sizeColumns,
    sizeRows,
  });
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
  const removed = await removeDashboardItem(itemId);
  if (!removed) {
    throw error(404, "Dashboard item not found");
  }

  emitDashboardItemRemoved(params.id, itemId);

  return json({ success: true });
};
