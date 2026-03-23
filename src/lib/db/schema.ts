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

export const counters = pgTable("counters", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  count: integer("count").default(0).notNull(),
  isPublic: integer("is_public").default(1).notNull(), // 1 for public, 0 for private
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
    role: text("role").notNull().default("viewer"), // "viewer" | "editor" | "admin"
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

export type SparklinePoint = {
  value: number;
  timestamp: string;
};
