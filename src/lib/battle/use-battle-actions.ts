import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { activityQuery, battleStatsQuery } from "@/lib/activity/queries"
import { resetBattle, scoreBattle } from "./functions"
import { battleLogQuery, battleQuery } from "./queries"
import type { BattleState, Side } from "./types"

/**
 * Admin actions for the battle. Updates the score optimistically so taps feel
 * instant; the server's broadcast then confirms it (and triggers effects).
 */
export function useBattleActions() {
  const queryClient = useQueryClient()
  const key = battleQuery.queryKey

  const settle = () =>
    Promise.all(
      [
        battleLogQuery.queryKey,
        battleStatsQuery.queryKey,
        activityQuery.queryKey,
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey }))
    )
  const fail = (error: unknown, previous?: BattleState) => {
    if (previous) queryClient.setQueryData(key, previous)
    toast.error("Kunde inte uppdatera", {
      description: error instanceof Error ? error.message : undefined,
    })
  }

  const score = useMutation({
    mutationFn: (vars: { side: Side; delta: 1 | -1 }) =>
      scoreBattle({ data: vars }),
    onMutate: async ({ side, delta }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<BattleState>(key)
      if (previous)
        queryClient.setQueryData(key, {
          ...previous,
          [side]: Math.max(0, previous[side] + delta),
        })
      return { previous }
    },
    onError: (error, _vars, ctx) => fail(error, ctx?.previous),
    onSuccess: (state) => {
      const current = queryClient.getQueryData<BattleState>(key)
      if (!current || state.version >= current.version)
        queryClient.setQueryData(key, state)
    },
    onSettled: settle,
  })

  const reset = useMutation({
    mutationFn: () => resetBattle(),
    onError: (error) => fail(error),
    onSuccess: (state) => {
      queryClient.setQueryData(key, state)
      toast.success("Ny rond! Båda står på 0.")
    },
    onSettled: settle,
  })

  return {
    hit: (side: Side) => score.mutate({ side, delta: 1 }),
    undo: (side: Side) => score.mutate({ side, delta: -1 }),
    reset: () => reset.mutate(),
    resetting: reset.isPending,
  }
}
