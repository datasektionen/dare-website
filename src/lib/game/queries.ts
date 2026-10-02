import { queryOptions } from "@tanstack/react-query"
import type { ScoreView } from "./admin"
import { getGameOverview, getScores } from "./admin-functions"
import { getGameLink, getLeaderboard } from "./functions"

/** Whether the start page shows a link to the game. */
export const gameLinkQuery = queryOptions({
  queryKey: ["game", "link"],
  queryFn: () => getGameLink(),
})

export const leaderboardQuery = queryOptions({
  queryKey: ["game", "leaderboard"],
  queryFn: () => getLeaderboard(),
})

/** Saved runs for the dashboard, in one view, optionally searched. */
export const scoresQuery = (opts: {
  q: string
  view: ScoreView
  device: string | null
  limit: number
}) =>
  queryOptions({
    queryKey: ["game", "scores", opts],
    queryFn: () => getScores({ data: opts }),
  })

/** Settings, today's numbers and bans, for the dashboard. */
export const gameOverviewQuery = queryOptions({
  queryKey: ["game", "overview"],
  queryFn: () => getGameOverview(),
})
