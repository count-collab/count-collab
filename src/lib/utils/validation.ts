import { z } from "zod";
import { teamJoinLinkRoles, teamMemberRoles } from "$lib/db/schema";

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
    .max(500, "Description must be less than 500 characters")
    .optional()
    .default("")
    .transform((val) => val?.trim() || ""),
  visibility: counterVisibilityEnum.default("public").optional(),
  counterMode: counterModeEnum.default("increment_only").optional(),
  teamId: z.string().uuid("Invalid team ID format").optional(),
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
    .refine((v) => v !== 0, "Increment amount must be non-zero")
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
  teamId: z.string().uuid("Invalid team ID format").optional(),
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

export const updateInvitationRoleSchema = z.object({
  role: counterMemberRoleEnum,
});
export type UpdateInvitationRoleInput = z.infer<
  typeof updateInvitationRoleSchema
>;

export const updateDashboardInvitationRoleSchema = z.object({
  role: dashboardMemberRoleEnum,
});
export type UpdateDashboardInvitationRoleInput = z.infer<
  typeof updateDashboardInvitationRoleSchema
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

// ── Counter Goals ───────────────────────────────────────────────

export const createGoalSchema = z.object({
  amount: z.number().int(),
  description: z.string().max(200).trim().optional().default(""),
});
export type CreateGoalInput = z.infer<typeof createGoalSchema>;

export const updateGoalSchema = z.object({
  amount: z.number().int().optional(),
  description: z.string().max(200).trim().optional(),
});
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;

// ── Teams ───────────────────────────────────────────────────────

export const teamIdSchema = z.string().uuid("Invalid team ID format");

export const teamMemberRoleEnum = z.enum(teamMemberRoles);
export const teamJoinLinkRoleEnum = z.enum(teamJoinLinkRoles);

export const createTeamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(50, "Name must be at most 50 characters"),
  description: z
    .string()
    .trim()
    .max(500, "Description must be less than 500 characters")
    .nullish()
    // Keep undefined so a partial update leaves the description untouched
    .transform((val) => (val === undefined ? undefined : val || null)),
});
export type CreateTeamInput = z.infer<typeof createTeamSchema>;

export const updateTeamSchema = createTeamSchema.partial();
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;

export const teamInviteSchema = z.object({
  username: usernameSchema,
  role: teamMemberRoleEnum,
});
export type TeamInviteInput = z.infer<typeof teamInviteSchema>;

export const teamRoleSchema = z.object({
  role: teamMemberRoleEnum,
});
export type TeamRoleInput = z.infer<typeof teamRoleSchema>;

export const joinLinkRoleSchema = z.object({
  role: teamJoinLinkRoleEnum,
});
export type JoinLinkRoleInput = z.infer<typeof joinLinkRoleSchema>;

export const joinTeamSchema = z.object({
  token: z.string().min(1, "Token is required").max(200),
});
export type JoinTeamInput = z.infer<typeof joinTeamSchema>;

export const deleteTeamSchema = z.object({
  confirmName: z.string(),
});
export type DeleteTeamInput = z.infer<typeof deleteTeamSchema>;

export const transferSchema = z.object({
  teamId: z.string().uuid("Invalid team ID format").nullable(),
  counterIds: z
    .array(z.string().uuid("Invalid counter ID format"))
    .max(100)
    .optional()
    .default([]),
});
export type TransferInput = z.infer<typeof transferSchema>;

// ── Global Settings ─────────────────────────────────────────────

export const updateGlobalSettingsSchema = z.object({
  counterCreationLimitAuth: z.number().int().positive().optional(),
  counterCreationWindowAuth: z.number().int().positive().optional(),
  counterCreationLimitUnauth: z.number().int().positive().optional(),
  counterCreationWindowUnauth: z.number().int().positive().optional(),
  dashboardCreationLimitAuth: z.number().int().positive().optional(),
  dashboardCreationWindowAuth: z.number().int().positive().optional(),
  dashboardCreationLimitUnauth: z.number().int().positive().optional(),
  dashboardCreationWindowUnauth: z.number().int().positive().optional(),
  teamCreationLimitAuth: z.number().int().positive().optional(),
  teamCreationWindowAuth: z.number().int().positive().optional(),
  incrementCooldownMsAuth: z.number().int().positive().optional(),
  incrementCooldownMsUnauth: z.number().int().positive().optional(),
});
export type UpdateGlobalSettingsInput = z.infer<
  typeof updateGlobalSettingsSchema
>;
