import { pgTable, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull(),
  senderId: text("sender_id").notNull().references(() => user.id),
  recipientId: text("recipient_id").notNull().references(() => user.id),
  content: text("content").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => ({
  conversationIdx: index("idx_messages_conversation_id").on(table.conversationId),
  createdAtIdx: index("idx_messages_created_at").on(table.createdAt),
  recipientUnreadIdx: index("idx_messages_recipient_unread").on(table.recipientId, table.isRead),
}));

export const userPresence = pgTable("user_presence", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique().references(() => user.id, { onDelete: "cascade" }),
  lastHeartbeat: timestamp("last_heartbeat", { mode: "date" }).notNull(),
  status: text("status").default("offline").notNull(),
}, (table) => ({
  userIdIdx: index("idx_user_presence_user_id").on(table.userId),
}));
