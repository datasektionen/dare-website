import { CAN_POINTS } from "./puckopist"

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

/**
 * Whether a score could have come from a real run. Scores come from the
 * browser, so this only stops the obvious fakes: the score is metres, plus
 * 10 per can, plus trick points (always a multiple of 25), and there are only
 * so many cans and flips per metre.
 */
export function isPlausible({ score, cans, distance }: RunResult) {
  const tricks = score - distance - cans * CAN_POINTS
  return (
    tricks >= 0 &&
    tricks % 25 === 0 &&
    cans <= distance / 4 + 10 &&
    tricks <= distance * 30 + 500
  )
}
