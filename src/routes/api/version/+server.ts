import { json } from "@sveltejs/kit";
import { buildInfo } from "$lib/server/build-info.generated";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
  return json(buildInfo, { status: 200 });
};
