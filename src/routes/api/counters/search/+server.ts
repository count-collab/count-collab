import { json } from "@sveltejs/kit";
import { listPublicCounters } from "$lib/server/counters";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const limit = Math.min(
    20,
    Math.max(1, Number(url.searchParams.get("limit")) || 20),
  );

  const { items } = await listPublicCounters(limit, query || undefined);

  return json({
    counters: items.map((c) => ({
      id: c.id,
      title: c.title,
      count: c.count,
      description: c.description,
    })),
  });
};
