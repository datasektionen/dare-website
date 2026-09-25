import { sql } from "drizzle-orm"
import {
  check,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

/** Jäger vs Minttu score. Always a single row with `id = 1`. */
export const battle = pgTable(
  "battle",
  {
    id: integer().primaryKey().default(1),
    jaeger: integer().notNull().default(0),
    minttu: integer().notNull().default(0),
    /** Bumped on every change, so clients can ignore stale updates. */
    version: integer().notNull().default(0),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("battle_singleton", sql`${t.id} = 1`),
    check("battle_non_negative", sql`${t.jaeger} >= 0 AND ${t.minttu} >= 0`),
  ]
)

/** Every hit, undo and reset, with who did it. */
export const battleEvents = pgTable("battle_events", {
  id: serial().primaryKey(),
  /** `hit` (+1), `undo` (−1) or `reset`. */
  kind: text({ enum: ["hit", "undo", "reset"] }).notNull(),
  side: text({ enum: ["jaeger", "minttu"] }),
  by: text().notNull(),
  byName: text().notNull(),
  at: timestamp({ withTimezone: true }).notNull().defaultNow(),
})
