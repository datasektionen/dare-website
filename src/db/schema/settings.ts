import { sql } from "drizzle-orm"
import {
  check,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

/** Site-wide settings. Always a single row with `id = 1`. */
export const siteSettings = pgTable(
  "site_settings",
  {
    id: integer().primaryKey().default(1),
    ticketReleaseAt: timestamp({ withTimezone: true }).notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** kthid of the admin who last changed the settings. */
    updatedBy: text(),
  },
  (t) => [check("site_settings_singleton", sql`${t.id} = 1`)]
)

/** Audit log of every change to the ticket release time. */
export const ticketReleaseChanges = pgTable("ticket_release_changes", {
  id: serial().primaryKey(),
  releaseAt: timestamp({ withTimezone: true }).notNull(),
  changedBy: text().notNull(),
  changedByName: text().notNull(),
  changedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})
