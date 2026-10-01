import { createInsertSchema } from "drizzle-zod";
import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const scansTable = pgTable(
  "trustshield_scans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    inputType: text("input_type").notNull(),
    riskLevel: text("risk_level").notNull(),
    riskScore: integer("risk_score").notNull(),
    privacyFindingCount: integer("privacy_finding_count").notNull().default(0),
    threatIndicatorCount: integer("threat_indicator_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("trustshield_scans_user_created_idx").on(table.userId, table.createdAt)],
);

export const insertScanSchema = createInsertSchema(scansTable).omit({
  id: true,
  createdAt: true,
});
export type InsertScan = z.infer<typeof insertScanSchema>;
export type Scan = typeof scansTable.$inferSelect;