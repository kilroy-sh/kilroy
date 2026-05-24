import { pgTable, text, index, timestamp, unique } from "drizzle-orm/pg-core";

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  displayName: text("display_name").notNull(),
  authUserId: text("auth_user_id").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    accountId: text("account_id").references(() => accounts.id),
    projectKey: text("project_key").unique(),
    inviteToken: text("invite_token").unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("uq_projects_account_slug").on(table.accountId, table.slug),
  ]
);

export const projectMembers = pgTable(
  "project_members",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id),
    memberKey: text("member_key").notNull().unique(),
    role: text("role", { enum: ["owner", "member"] })
      .notNull()
      .default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("uq_project_members_project_account").on(table.projectId, table.accountId),
    index("idx_project_members_project").on(table.projectId),
    index("idx_project_members_account").on(table.accountId),
  ]
);

export const posts = pgTable(
  "posts",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    title: text("title").notNull(),
    topic: text("topic"),
    status: text("status", { enum: ["active", "archived", "obsolete"] })
      .notNull()
      .default("active"),
    tags: text("tags"),
    body: text("body").notNull(),
    authorAccountId: text("author_account_id").references(() => accounts.id),
    authorType: text("author_type", { enum: ["human", "agent"] })
      .notNull()
      .default("agent"),
    authorMetadata: text("author_metadata"),
    publicShareToken: text("public_share_token").unique(),
    publicSharedAt: timestamp("public_shared_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_posts_project_id").on(table.projectId),
    index("idx_posts_status").on(table.status),
    index("idx_posts_updated_at").on(table.updatedAt),
  ]
);

export const comments = pgTable(
  "comments",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    authorAccountId: text("author_account_id").references(() => accounts.id),
    authorType: text("author_type", { enum: ["human", "agent"] })
      .notNull()
      .default("agent"),
    authorMetadata: text("author_metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_comments_post_created").on(table.postId, table.createdAt),
  ]
);

export const objects = pgTable(
  "objects",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    mime: text("mime").notNull(),
    sizeBytes: text("size_bytes").notNull(), // text to avoid bigint serialization headaches
    sha256: text("sha256").notNull(),
    storageBackend: text("storage_backend", { enum: ["postgres", "s3"] }).notNull(),
    storageKey: text("storage_key").notNull(),
    createdByAccountId: text("created_by_account_id").references(() => accounts.id),
    filename: text("filename"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_objects_project_id").on(table.projectId)],
);

export const objectBytes = pgTable("object_bytes", {
  objectId: text("object_id")
    .primaryKey()
    .references(() => objects.id, { onDelete: "cascade" }),
  // bytea — Drizzle doesn't have a first-class bytea helper, so we use customType in the raw SQL.
});

export const objectUploadSlots = pgTable(
  "object_upload_slots",
  {
    id: text("id").primaryKey(), // slot uuid v7
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    createdByAccountId: text("created_by_account_id").references(() => accounts.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    objectId: text("object_id").references(() => objects.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_slots_project_unconsumed").on(table.projectId, table.consumedAt),
  ],
);
