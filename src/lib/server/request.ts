import { json } from "@sveltejs/kit";
import type { z } from "zod";
import { logger } from "./logger";

export type ValidateResult<T> =
  | { success: true; data: T }
  | { success: false; response: Response };

/**
 * Parse and validate request body using a Zod schema.
 * Returns parsed data on success or a JSON error response on failure.
 *
 * @param request - The SvelteKit request object
 * @param schema - Zod schema for validation
 * @param context - Optional context string for logging (e.g., "Counter creation")
 * @returns Result object with either data or error response
 *
 * @example
 * const result = await parseAndValidateBody(request, createCounterSchema, "Create counter");
 * if (!result.success) return result.response;
 * const { title, description } = result.data;
 */
export async function parseAndValidateBody<T>(
  request: Request,
  schema: z.ZodSchema<T>,
  context = "Request",
): Promise<ValidateResult<T>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch (_error) {
    const errorMsg = `${context}: Invalid JSON payload`;
    logger.warn(errorMsg);
    return {
      success: false,
      response: json({ error: "Invalid JSON payload" }, { status: 400 }),
    };
  }

  const validation = schema.safeParse(body);

  if (!validation.success) {
    const errors = validation.error.flatten().fieldErrors;
    logger.warn(`${context}: Validation failed`, { errors });
    return {
      success: false,
      response: json({ errors }, { status: 400 }),
    };
  }

  return {
    success: true,
    data: validation.data,
  };
}
