import { z } from "zod";

export const counterVisibilityEnum = z.enum([
  "public",
  "public_readonly",
  "private",
]);

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
  visibility: counterVisibilityEnum.default("public").optional(),
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
  visibility: counterVisibilityEnum.optional(),
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
export const counterMemberRoleEnum = z.enum([
  "viewer",
  "incrementer",
  "editor",
  "admin",
]);

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

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

// Dashboard validation
export const dashboardVisibilityEnum = z.enum(["public", "private"]);

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
  visibility: dashboardVisibilityEnum.default("public").optional(),
});
export type CreateDashboardInput = z.infer<typeof createDashboardSchema>;

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
  visibility: dashboardVisibilityEnum.optional(),
});
export type UpdateDashboardInput = z.infer<typeof updateDashboardSchema>;

export const dashboardIdSchema = z.string().uuid("Invalid dashboard ID format");
export type DashboardId = z.infer<typeof dashboardIdSchema>;

export const dashboardMemberRoleEnum = z.enum(["viewer", "editor", "admin"]);

export const inviteDashboardMemberSchema = z.object({
  username: usernameSchema,
  role: dashboardMemberRoleEnum.default("viewer"),
});
export type InviteDashboardMemberInput = z.infer<
  typeof inviteDashboardMemberSchema
>;

export const updateDashboardMemberRoleSchema = z.object({
  role: dashboardMemberRoleEnum,
});
export type UpdateDashboardMemberRoleInput = z.infer<
  typeof updateDashboardMemberRoleSchema
>;

export const addDashboardItemSchema = z.object({
  counterId: z.string().uuid("Invalid counter ID format"),
  positionX: z.number().int().min(0).max(4),
  positionY: z.number().int().min(0),
  sizeColumns: z.number().int().min(1).max(5).default(1),
  sizeRows: z.number().int().min(1).max(4).default(1),
});
export type AddDashboardItemInput = z.infer<typeof addDashboardItemSchema>;

export const moveDashboardItemSchema = z.object({
  itemId: z.number().int().positive(),
  positionX: z.number().int().min(0).max(4),
  positionY: z.number().int().min(0),
});
export type MoveDashboardItemInput = z.infer<typeof moveDashboardItemSchema>;

export const resizeDashboardItemSchema = z.object({
  itemId: z.number().int().positive(),
  sizeColumns: z.number().int().min(1).max(5),
  sizeRows: z.number().int().min(1).max(4),
});
export type ResizeDashboardItemInput = z.infer<
  typeof resizeDashboardItemSchema
>;

export const swapDashboardItemsSchema = z.object({
  itemId1: z.number().int().positive(),
  itemId2: z.number().int().positive(),
});
export type SwapDashboardItemsInput = z.infer<typeof swapDashboardItemsSchema>;
