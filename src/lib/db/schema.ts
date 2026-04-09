// Database schema and types

import {
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ── Auth.js tables ──────────────────────────────────────────────

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  username: text("username").unique(),
  roleId: integer("role_id").references(() => roles.id),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compositePk: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  }),
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => ({
    compositePk: primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  }),
);

// ── Roles & Permissions ─────────────────────────────────────────

export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
});

export const permissions = pgTable("permissions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: integer("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (rp) => ({
    compositePk: primaryKey({ columns: [rp.roleId, rp.permissionId] }),
  }),
);

// ── Counters ────────────────────────────────────────────────────

export const counterVisibilityModes = [
  "private",
  "public",
  "public_readonly",
] as const;

export type CounterVisibilityMode = (typeof counterVisibilityModes)[number];

export const counterMemberRoles = [
  "viewer",
  "incrementer",
  "editor",
  "admin",
] as const;

export type CounterMemberRole = (typeof counterMemberRoles)[number];

export const counters = pgTable("counters", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  count: integer("count").default(0).notNull(),
  isPublic: integer("is_public").default(1).notNull(), // Legacy compatibility flag: 1 for publicly viewable, 0 for private
  visibilityMode: text("visibility_mode", { enum: counterVisibilityModes })
    .default("public")
    .notNull(),
  shareToken: text("share_token").unique(),
  ownerId: text("owner_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const counterHistory = pgTable(
  "counter_history",
  {
    id: serial("id").primaryKey(),
    counterId: uuid("counter_id")
      .notNull()
      .references(() => counters.id, { onDelete: "cascade" }),
    previousValue: integer("previous_value").notNull(),
    newValue: integer("new_value").notNull(),
    changedBy: text("changed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    counterChangedAtIdx: index("counter_history_counter_id_changed_at_idx").on(
      t.counterId,
      t.changedAt,
    ),
  }),
);

// ── Counter Members ─────────────────────────────────────────────

export const counterMembers = pgTable(
  "counter_members",
  {
    id: serial("id").primaryKey(),
    counterId: uuid("counter_id")
      .notNull()
      .references(() => counters.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: counterMemberRoles })
      .notNull()
      .default("viewer"), // "viewer" | "incrementer" | "editor" | "admin"; incrementer can add to the count without broader edit access
    invitedAt: timestamp("invited_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (cm) => ({
    uniqueMember: uniqueIndex("counter_members_counter_user_idx").on(
      cm.counterId,
      cm.userId,
    ),
  }),
);

// ── Dashboards ───────────────────────────────────────────────────

export const dashboardVisibilityModes = ["private", "public"] as const;

export type DashboardVisibilityMode = (typeof dashboardVisibilityModes)[number];

export const dashboardMemberRoles = ["viewer", "editor", "admin"] as const;

export type DashboardMemberRole = (typeof dashboardMemberRoles)[number];

export const dashboards = pgTable("dashboards", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  visibilityMode: text("visibility_mode", { enum: dashboardVisibilityModes })
    .default("public")
    .notNull(),
  shareToken: text("share_token").unique(),
  ownerId: text("owner_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const dashboardItems = pgTable(
  "dashboard_items",
  {
    id: serial("id").primaryKey(),
    dashboardId: uuid("dashboard_id")
      .notNull()
      .references(() => dashboards.id, { onDelete: "cascade" }),
    counterId: uuid("counter_id")
      .notNull()
      .references(() => counters.id, { onDelete: "cascade" }),
    positionX: integer("position_x").notNull().default(0),
    positionY: integer("position_y").notNull().default(0),
    sizeColumns: integer("size_columns").notNull().default(1),
    sizeRows: integer("size_rows").notNull().default(1),
  },
  (di) => ({
    dashboardIdx: index("dashboard_items_dashboard_id_idx").on(di.dashboardId),
  }),
);

export const dashboardMembers = pgTable(
  "dashboard_members",
  {
    id: serial("id").primaryKey(),
    dashboardId: uuid("dashboard_id")
      .notNull()
      .references(() => dashboards.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: dashboardMemberRoles })
      .notNull()
      .default("viewer"),
    invitedAt: timestamp("invited_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (dm) => ({
    uniqueMember: uniqueIndex("dashboard_members_dashboard_user_idx").on(
      dm.dashboardId,
      dm.userId,
    ),
  }),
);

// ── Followers ────────────────────────────────────────────────────

export const counterFollowers = pgTable(
  "counter_followers",
  {
    id: serial("id").primaryKey(),
    counterId: uuid("counter_id")
      .notNull()
      .references(() => counters.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followedAt: timestamp("followed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (cf) => ({
    uniqueFollow: uniqueIndex("counter_followers_counter_user_idx").on(
      cf.counterId,
      cf.userId,
    ),
  }),
);

export const dashboardFollowers = pgTable(
  "dashboard_followers",
  {
    id: serial("id").primaryKey(),
    dashboardId: uuid("dashboard_id")
      .notNull()
      .references(() => dashboards.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followedAt: timestamp("followed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (df) => ({
    uniqueFollow: uniqueIndex("dashboard_followers_dashboard_user_idx").on(
      df.dashboardId,
      df.userId,
    ),
  }),
);

// ── Type exports ────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;

export type Counter = typeof counters.$inferSelect;
export type NewCounter = typeof counters.$inferInsert;
export type CounterHistory = typeof counterHistory.$inferSelect;
export type NewCounterHistory = typeof counterHistory.$inferInsert;

export type CounterMember = typeof counterMembers.$inferSelect;
export type NewCounterMember = typeof counterMembers.$inferInsert;

export type Dashboard = typeof dashboards.$inferSelect;
export type NewDashboard = typeof dashboards.$inferInsert;
export type DashboardItem = typeof dashboardItems.$inferSelect;
export type NewDashboardItem = typeof dashboardItems.$inferInsert;
export type DashboardMember = typeof dashboardMembers.$inferSelect;
export type NewDashboardMember = typeof dashboardMembers.$inferInsert;

export type CounterFollower = typeof counterFollowers.$inferSelect;
export type NewCounterFollower = typeof counterFollowers.$inferInsert;

export type DashboardFollower = typeof dashboardFollowers.$inferSelect;
export type NewDashboardFollower = typeof dashboardFollowers.$inferInsert;

export type SparklinePoint = {
  value: number;
  timestamp: string;
};
