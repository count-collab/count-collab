import { json } from "@sveltejs/kit";
import { db } from "$lib/db";
import { counters } from "$lib/db/schema";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
  try {
    // Check database connectivity by running a simple query
    await db.select().from(counters).limit(1);

    return json(
      {
        status: "healthy",
        timestamp: new Date().toISOString(),
        database: "connected",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[health] Database check failed:", error);

    return json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        database: "disconnected",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 },
    );
  }
};
