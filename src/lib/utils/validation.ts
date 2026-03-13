import { z } from "zod";

/**
 * Validation schema for counter creation
 */
export const createCounterSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters")
    .trim(),
  description: z
    .string()
    .max(1000, "Description must be less than 1000 characters")
    .optional()
    .default("")
    .transform((val) => val?.trim() || ""),
  visibility: z.enum(["public", "private"]).default("public").optional(),
});

export type CreateCounterInput = z.infer<typeof createCounterSchema>;

/**
 * Validation schema for counter updates
 */
export const updateCounterSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters")
    .trim()
    .optional(),
  description: z
    .string()
    .max(1000, "Description must be less than 1000 characters")
    .transform((val) => val?.trim() || "")
    .optional(),
  visibility: z.enum(["public", "private"]).optional(),
});

export type UpdateCounterInput = z.infer<typeof updateCounterSchema>;

/**
 * Validation schema for counter ID (UUID format)
 */
export const counterIdSchema = z.string().uuid("Invalid counter ID format");

export type CounterId = z.infer<typeof counterIdSchema>;

/**
 * Validation schema for increment payload
 */
export const incrementCounterSchema = z.object({
  amount: z
    .number()
    .int("Increment amount must be an integer")
    .positive("Increment amount must be positive")
    .default(1)
    .optional(),
});

export type IncrementCounterInput = z.infer<typeof incrementCounterSchema>;

/**
 * Validation schema for usernames
 */
export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be at most 30 characters")
  .regex(
    /^[a-zA-Z0-9_]+$/,
    "Username can only contain letters, numbers, and underscores",
  )
  .transform((val) => val.toLowerCase());

export type Username = z.infer<typeof usernameSchema>;

/**
 * Counter member roles
 */
export const counterMemberRoleEnum = z.enum(["viewer", "editor", "admin"]);

/**
 * Validation schema for inviting a member to a counter
 */
export const inviteMemberSchema = z.object({
  username: usernameSchema,
  role: counterMemberRoleEnum.default("viewer"),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

/**
 * Validation schema for updating a member's role
 */
export const updateMemberRoleSchema = z.object({
  role: counterMemberRoleEnum,
});

// ── Dashboard validation ────────────────────────────────────────

/**
 * Validation schema for dashboard creation
 */
export const createDashboardSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters")
    .trim(),
  description: z
    .string()
    .max(1000, "Description must be less than 1000 characters")
    .optional()
    .default("")
    .transform((val) => val?.trim() || ""),
  visibility: z.enum(["public", "private"]).default("private").optional(),
});

export type CreateDashboardInput = z.infer<typeof createDashboardSchema>;

/**
 * Validation schema for dashboard updates
 */
export const updateDashboardSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters")
    .trim()
    .optional(),
  description: z
    .string()
    .max(1000, "Description must be less than 1000 characters")
    .transform((val) => val?.trim() || "")
    .optional(),
  visibility: z.enum(["public", "private"]).optional(),
});

export type UpdateDashboardInput = z.infer<typeof updateDashboardSchema>;

/**
 * Validation schema for dashboard ID (UUID format)
 */
export const dashboardIdSchema = z.string().uuid("Invalid dashboard ID format");

export type DashboardId = z.infer<typeof dashboardIdSchema>;

/**
 * Validation schema for adding a counter to a dashboard
 */
export const addCounterToDashboardSchema = z.object({
  counterId: z.string().uuid("Invalid counter ID format"),
});

export type AddCounterToDashboardInput = z.infer<
  typeof addCounterToDashboardSchema
>;

/**
 * Validation schema for removing a counter from a dashboard
 */
export const removeCounterFromDashboardSchema = z.object({
  counterId: z.string().uuid("Invalid counter ID format"),
});

/**
 * Dashboard member roles (same as counter member roles)
 */
export const dashboardMemberRoleEnum = z.enum(["viewer", "editor", "admin"]);

/**
 * Validation schema for inviting a member to a dashboard
 */
export const inviteDashboardMemberSchema = z.object({
  username: usernameSchema,
  role: dashboardMemberRoleEnum.default("viewer"),
});

export type InviteDashboardMemberInput = z.infer<
  typeof inviteDashboardMemberSchema
>;

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
