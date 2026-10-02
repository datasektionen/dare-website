import { and, eq, gte, type SQL } from "drizzle-orm"
import { db } from "@/db"
import { gameScores, siteSettings } from "@/db/schema"

export type GameSettings = {
  /** Runs can be saved to the leaderboard. */
  saving: boolean
  /** Flagged runs wait for an admin before showing. */
  holdFlagged: boolean
  /** A link to the game in the start page's menu. */
  inNav: boolean
  /** The leaderboard only counts runs from here on. */
  since: Date | null
}

const DEFAULTS: GameSettings = {
  saving: true,
  holdFlagged: true,
  inNav: false,
  since: null,
}

/** Puckopist's settings. Server-only (it queries the database). */
export async function readGameSettings(): Promise<GameSettings> {
  const [row] = await db
    .select({
      saving: siteSettings.puckopistSaving,
      holdFlagged: siteSettings.puckopistHoldFlagged,
      inNav: siteSettings.puckopistInNav,
      since: siteSettings.puckopistSince,
    })
    .from(siteSettings)
    .where(eq(siteSettings.id, 1))
  return row ?? DEFAULTS
}

/** Runs that count on the public leaderboard right now. */
export function onLeaderboard(since: Date | null): SQL {
  return since
    ? (and(eq(gameScores.status, "visible"), gte(gameScores.at, since)) as SQL)
    : eq(gameScores.status, "visible")
}
