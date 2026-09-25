export type Side = "jaeger" | "minttu"
export const SIDES: Side[] = ["jaeger", "minttu"]

export type BattleEventKind = "hit" | "undo" | "reset"

export type BattleState = {
  jaeger: number
  minttu: number
  version: number
  updatedAt: string | null
}

/** A change, as broadcast to every open /battle page. */
export type BattleUpdate = BattleState & {
  event: { kind: BattleEventKind; side: Side | null } | null
}

export type BattleLogEntry = {
  id: number
  kind: BattleEventKind
  side: Side | null
  by: string
  byName: string
  at: string
}

export const SIDE_NAMES: Record<Side, string> = {
  jaeger: "Jäger",
  minttu: "Minttu",
}

/** Jäger's share of the votes in [0, 1]; 0.5 when nobody has voted. */
export function jaegerShare({
  jaeger,
  minttu,
}: Pick<BattleState, "jaeger" | "minttu">) {
  const total = jaeger + minttu
  return total === 0 ? 0.5 : jaeger / total
}

/** Percentages that always add up to 100, e.g. [66.7, 33.3]. */
export function percentages(
  state: Pick<BattleState, "jaeger" | "minttu">
): [number, number] {
  const j = Math.round(jaegerShare(state) * 1000) / 10
  return [j, Math.round((100 - j) * 10) / 10]
}

export function leader(
  state: Pick<BattleState, "jaeger" | "minttu">
): Side | null {
  if (state.jaeger === state.minttu) return null
  return state.jaeger > state.minttu ? "jaeger" : "minttu"
}
