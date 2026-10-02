/* Kept apart from the database schema so the game can use them in the browser. */

/**
 * Why a run looks suspicious. Flagged runs are held for review when the
 * setting is on; see `HOLD_FLAGS` in `./anticheat`.
 */
export const GAME_FLAGS = [
  /** The browser's developer tools were open during the run. */
  "devtools",
  /** Timers or the frame loop had been replaced (e.g. to slow the game). */
  "hooked",
  /** Took far longer in real time than in the game: slow motion or paused. */
  "slow",
  /** The run's own digest or score didn't match the server's replay. */
  "mismatch",
  /** No checksum, e.g. an old browser without Web Crypto. */
  "nomac",
  /** Saved before runs were replayed on the server. */
  "unverified",
] as const
export type GameFlag = (typeof GAME_FLAGS)[number]

/**
 * - visible: on the leaderboard.
 * - held: flagged, waiting for an admin to approve it.
 * - hidden: hidden by an admin.
 * - shadow: from a shadow-banned player, who still sees it as saved.
 */
export const SCORE_STATUSES = ["visible", "held", "hidden", "shadow"] as const
export type ScoreStatus = (typeof SCORE_STATUSES)[number]

export const BAN_KINDS = ["device", "fingerprint", "ip", "name"] as const
export type BanKind = (typeof BAN_KINDS)[number]
