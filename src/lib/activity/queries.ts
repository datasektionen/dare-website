import { queryOptions } from "@tanstack/react-query"
import { getActivity, getBattleStats } from "./functions"

export const activityQuery = queryOptions({
  queryKey: ["activity"],
  queryFn: () => getActivity(),
})

export const battleStatsQuery = queryOptions({
  queryKey: ["battle", "stats"],
  queryFn: () => getBattleStats(),
})
