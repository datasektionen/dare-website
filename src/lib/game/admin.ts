import { LEADERBOARD_SIZE, type ScoreEntry } from "./leaderboard"

/** How many runs the dashboard lists at a time ("Visa fler" adds as many). */
export const PAGE_SIZE = 50

/** A saved run as admins see it. */
export type AdminScoreEntry = ScoreEntry & {
  /** Runs saved under the same name (ignoring case), this one included. */
  sameName: number
}

export type AdminScores = {
  entries: AdminScoreEntry[]
  /** Runs matching the search, of which `entries` are the first. */
  matching: number
  /** All saved runs. */
  total: number
}

/** Whether a run is on the public leaderboard on /game. */
export function isOnLeaderboard(rank: number) {
  return rank <= LEADERBOARD_SIZE
}

/**
 * An `ILIKE` pattern matching names that contain `q`, with SQL wildcards
 * typed into the search box matched literally.
 */
export function containsPattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}

/** E.g. "tog bort ”Kalle” (1 234 p) från Puckopist". */
export function describeRemoval({
  name,
  runs,
  bestScore,
}: {
  name: string
  runs: number
  bestScore: number
}) {
  const score = bestScore.toLocaleString("sv-SE")
  return runs === 1
    ? `tog bort ”${name}” (${score} p) från Puckopist`
    : `tog bort ${runs} åk av ”${name}” (bäst ${score} p) från Puckopist`
}
