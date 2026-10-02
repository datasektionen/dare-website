import { queryOptions } from "@tanstack/react-query"
import { getLeaderboard, getScores } from "./functions"

export const leaderboardQuery = queryOptions({
  queryKey: ["game", "leaderboard"],
  queryFn: () => getLeaderboard(),
})

/** All saved runs for the dashboard, optionally searched by name. */
export const scoresQuery = (q: string, limit: number) =>
  queryOptions({
    queryKey: ["game", "scores", { q, limit }],
    queryFn: () => getScores({ data: { q, limit } }),
  })
