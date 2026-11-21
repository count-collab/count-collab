import { z } from "zod";

export const counterVisibilityEnum = z.enum([
  "public",
  "public_readonly",
  "private",
]);

export const counterModeEnum = z.enum([
  "increment_only",
  "decrement_only",
  "both",
]);

const counterTitleSchema = z
  .string()
  .max(200, "Title must be less than 200 characters")
  .trim()
  .min(1, "Title is required");

export const createCounterSchema = z.object({
  title: counterTitleSchema,
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional()
    .default("")
    .transform((val) => val?.trim() || ""),
  visibility: counterVisibilityEnum.default("public").optional(),
  counterMode: counterModeEnum.default("increment_only").optional(),
  teamId: z.string().uuid("Invalid team ID format").optional(),
});

export type CreateCounterInput = z.infer<typeof createCounterSchema>;

export const updateCounterSchema = z.object({
  title: counterTitleSchema.optional(),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .transform((val) => val?.trim() || "")
    .nullable()
    .optional(),
  visibility: counterVisibilityEnum.optional(),
  counterMode: counterModeEnum.optional(),
  cooldownEnabled: z.boolean().optional(),
  cooldownSeconds: z.number().int().min(1).max(60).optional(),
  goalsEnabled: z.boolean().optional(),
  showAllReachedGoals: z.boolean().optional(),
  scoreboardEnabled: z.boolean().optional(),
});

export type UpdateCounterInput = z.infer<typeof updateCounterSchema>;
