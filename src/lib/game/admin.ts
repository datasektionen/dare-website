import type { BanKind, GameFlag, ScoreStatus } from "./constants"
import { LEADERBOARD_SIZE, type ScoreEntry } from "./leaderboard"

/** How many runs the dashboard lists at a time ("Visa fler" adds as many). */
export const PAGE_SIZE = 50

/** Which runs the dashboard lists. */
export const SCORE_VIEWS = ["alla", "granska", "flaggade", "dolda"] as const
export type ScoreView = (typeof SCORE_VIEWS)[number]

/** A saved run as admins see it. */
export type AdminScoreEntry = Omit<ScoreEntry, "rank"> & {
  /** Place on the leaderboard; null when it doesn't count there. */
  rank: number | null
  status: ScoreStatus
  flags: GameFlag[]
  /** Runs saved under the same name (ignoring case), this one included. */
  sameName: number
  /** Runs saved from the same device, this one included. */
  sameDevice: number
  device: string | null
  fingerprint: string | null
  ip: string | null
  /** Seconds the run lasted, from its replay. */
  seconds: number | null
  /** From before the leaderboard was last reset. */
  old: boolean
}

export type AdminScores = {
  entries: AdminScoreEntry[]
  /** Runs matching the search, of which `entries` are the first. */
  matching: number
  /** Saved runs in each view, ignoring the search. */
  views: Record<ScoreView, number>
}

export type AdminBan = {
  id: number
  kind: BanKind
  value: string
  label: string | null
  reason: string | null
  shadow: boolean
  createdByName: string
  createdAt: string
  expiresAt: string | null
}

export type GameOverview = {
  settings: {
    saving: boolean
    holdFlagged: boolean
    inNav: boolean
    since: string | null
  }
  today: {
    /** Runs finished today (Swedish time). */
    runs: number
    /** Devices that finished a run today. */
    players: number
    /** Runs refused today, e.g. finished faster than they could be played. */
    rejected: number
    /** Runs flagged today. */
    flagged: number
  }
  /** Runs on the leaderboard (since the last reset). */
  saved: number
  /** Runs waiting for approval. */
  held: number
  best: { name: string; score: number } | null
  bans: AdminBan[]
}

/** Whether a run is on the public leaderboard on /game. */
export function isOnLeaderboard(rank: number | null) {
  return rank !== null && rank <= LEADERBOARD_SIZE
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

/** E.g. "1 h", "24 h", "7 dagar", "tills vidare". */
export function describeDuration(hours: number | null) {
  if (hours === null) return "tills vidare"
  if (hours < 48) return `${hours} h`
  return `${Math.round(hours / 24)} dagar`
}

/** The start of a long id, to show and recognise it by. */
export function shortId(id: string | null) {
  return id ? id.slice(0, 8) : "–"
}
