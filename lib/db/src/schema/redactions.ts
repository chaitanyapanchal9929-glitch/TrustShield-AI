import { createInsertSchema } from "drizzle-zod";
import { index, integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const redactionsTable = pgTable(
  "trustshield_redactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    findingCount: integer("finding_count").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("trustshield_redactions_user_idx").on(table.userId)],
);

export const insertRedactionSchema = createInsertSchema(redactionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertRedaction = z.infer<typeof insertRedactionSchema>;
export type Redaction = typeof redactionsTable.$inferSelect;