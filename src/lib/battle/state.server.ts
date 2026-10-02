import { db } from "@/db"
import { battle } from "@/db/schema"
import type { BattleState } from "./types"

const EMPTY: BattleState = { jaeger: 0, minttu: 0, version: 0, updatedAt: null }

export function toState(row: typeof battle.$inferSelect): BattleState {
  return {
    jaeger: row.jaeger,
    minttu: row.minttu,
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** The current score. */
export async function readBattle(): Promise<BattleState> {
  const [row] = await db.select().from(battle)
  return row ? toState(row) : EMPTY
}
