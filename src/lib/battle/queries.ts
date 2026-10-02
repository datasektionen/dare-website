import { queryOptions } from "@tanstack/react-query"
import { getBattle, getBattleLog } from "./functions"
import { getJudges } from "./judge-functions"

export const battleQuery = queryOptions({
  queryKey: ["battle"],
  queryFn: () => getBattle(),
})

export const battleLogQuery = queryOptions({
  queryKey: ["battle", "log"],
  queryFn: () => getBattleLog(),
})

/** Everyone who may score besides admins, for the admins' list. */
export const judgesQuery = queryOptions({
  queryKey: ["battle", "judges"],
  queryFn: () => getJudges(),
})
