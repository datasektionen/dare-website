import { queryOptions } from "@tanstack/react-query"
import { getBattle, getBattleLog } from "./functions"

export const battleQuery = queryOptions({
  queryKey: ["battle"],
  queryFn: () => getBattle(),
})

export const battleLogQuery = queryOptions({
  queryKey: ["battle", "log"],
  queryFn: () => getBattleLog(),
})
