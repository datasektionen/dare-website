import { sql } from "drizzle-orm"
import {
  boolean,
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
    /**
     * Jäger vs Minttu is only used at the ticket release pub, so it's hidden
     * everywhere unless switched on in the dashboard settings.
     */
    battleEnabled: boolean().notNull().default(false),
    /**
     * The ticket release countdown. Not needed once tickets are out, so it
     * can be switched off (the landing page then hides the numbers).
     */
    ticketReleaseEnabled: boolean().notNull().default(true),
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

/** Audit log of features being switched on and off. */
export const featureChanges = pgTable("feature_changes", {
  id: serial().primaryKey(),
  feature: text({ enum: ["battle", "ticketRelease"] }).notNull(),
  enabled: boolean().notNull(),
  changedBy: text().notNull(),
  changedByName: text().notNull(),
  changedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})
