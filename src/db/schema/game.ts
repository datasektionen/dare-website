import { sql } from "drizzle-orm"
import {
  check,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

/** Puckopist (/game) runs saved to the leaderboard. */
export const gameScores = pgTable(
  "game_scores",
  {
    id: serial().primaryKey(),
    /** What the player typed in; not tied to an account. */
    name: text().notNull(),
    score: integer().notNull(),
    cans: integer().notNull(),
    /** Metres skied. */
    distance: integer().notNull(),
    at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("game_scores_score_idx").on(t.score.desc(), t.at),
    check(
      "game_scores_non_negative",
      sql`${t.score} >= 0 AND ${t.cans} >= 0 AND ${t.distance} >= 0`
    ),
    check(
      "game_scores_name_length",
      sql`char_length(${t.name}) BETWEEN 1 AND 20`
    ),
  ]
)

/** Audit log of admins removing runs from the leaderboard. */
export const gameScoreRemovals = pgTable("game_score_removals", {
  id: serial().primaryKey(),
  /** The name on the removed runs. */
  name: text().notNull(),
  /** How many runs were removed at once (all runs with a name, or one). */
  runs: integer().notNull(),
  /** Best score among the removed runs. */
  bestScore: integer().notNull(),
  removedBy: text().notNull(),
  removedByName: text().notNull(),
  removedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})
