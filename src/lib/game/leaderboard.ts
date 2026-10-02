/** Longest name on the leaderboard, in characters. */
export const NAME_MAX = 20
/** How many runs the leaderboard shows. */
export const LEADERBOARD_SIZE = 5

export type ScoreEntry = {
  id: number
  rank: number
  name: string
  score: number
  cans: number
  distance: number
  at: string
}

export type RunResult = { score: number; cans: number; distance: number }

/**
 * Tidies a typed-in name: no control characters, single spaces, at most
 * `NAME_MAX` characters (code points, as Postgres counts them).
 */
export function cleanName(name: string) {
  const tidy = name.replace(/\p{C}/gu, "").replace(/\s+/g, " ").trim()
  return Array.from(tidy).slice(0, NAME_MAX).join("").trim()
}
