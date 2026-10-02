import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { BAN_KINDS, GAME_FLAGS, SCORE_STATUSES } from "@/lib/game/constants"

/**
 * One go at Puckopist, from the ticket handed out before it starts (with the
 * piste's seed) to the server's replay of its presses after the crash.
 */
export const gameRuns = pgTable(
  "game_runs",
  {
    id: text().primaryKey(),
    seed: integer().notNull(),
    /** HMAC key for the run's checksum, hex. */
    key: text().notNull(),
    /** From the player's device cookie. */
    device: text().notNull(),
    /** A hash of the browser's traits, which survives clearing cookies. */
    fingerprint: text(),
    ip: text(),
    status: text({ enum: ["issued", "finished", "rejected", "saved"] })
      .notNull()
      .default("issued"),
    /** Why it couldn't be saved, when rejected. */
    rejected: text(),
    issuedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** When the player actually set off (the ticket is fetched in advance). */
    startedAt: timestamp({ withTimezone: true }),
    finishedAt: timestamp({ withTimezone: true }),
    ticks: integer(),
    score: integer(),
    cans: integer(),
    distance: integer(),
    flags: text({ enum: GAME_FLAGS }).array().notNull().default([]),
  },
  (t) => [
    index("game_runs_issued_idx").on(t.issuedAt),
    index("game_runs_device_idx").on(t.device),
  ]
)

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
    /** The replayed run it came from; null for runs saved before replays. */
    runId: text().references(() => gameRuns.id, { onDelete: "set null" }),
    device: text(),
    fingerprint: text(),
    ip: text(),
    status: text({ enum: SCORE_STATUSES }).notNull().default("visible"),
    flags: text({ enum: GAME_FLAGS }).array().notNull().default([]),
  },
  (t) => [
    index("game_scores_score_idx").on(t.score.desc(), t.at),
    uniqueIndex("game_scores_run_idx").on(t.runId),
    index("game_scores_device_idx").on(t.device),
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

/**
 * Players kept off the leaderboard. Players don't log in and many share the
 * same wifi, so bans go by device cookie and browser fingerprint rather than
 * IP (though IP is possible too), or by words in the name.
 */
export const gameBans = pgTable("game_bans", {
  id: serial().primaryKey(),
  kind: text({ enum: BAN_KINDS }).notNull(),
  /** The device id, fingerprint, IP, or (lower case) text in the name. */
  value: text().notNull(),
  reason: text(),
  /**
   * Shadow bans let the player keep playing and "saving", but nothing they
   * save shows up, so they don't know to get round it.
   */
  shadow: boolean().notNull().default(true),
  /** The name on the run it was made from, to recognise it by. */
  label: text(),
  createdBy: text().notNull(),
  createdByName: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  /** Null: until lifted. */
  expiresAt: timestamp({ withTimezone: true }),
  liftedAt: timestamp({ withTimezone: true }),
  liftedBy: text(),
  liftedByName: text(),
})

/** Audit log of admins managing Puckopist (removals have their own table). */
export const gameAdminEvents = pgTable("game_admin_events", {
  id: serial().primaryKey(),
  kind: text({
    enum: ["ban", "unban", "approve", "hide", "show", "reset", "setting"],
  }).notNull(),
  /** What happened, ready to show in the activity log. */
  detail: text().notNull(),
  by: text().notNull(),
  byName: text().notNull(),
  at: timestamp({ withTimezone: true }).notNull().defaultNow(),
})
