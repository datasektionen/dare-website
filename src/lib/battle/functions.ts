import { createServerFn } from "@tanstack/react-start"
import { desc, sql } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import { battle, battleEvents } from "@/db/schema"
import { adminMiddleware } from "@/lib/auth/functions"
import { requireFeature } from "@/lib/settings/functions"
import { publish } from "./bus.server"
import type { BattleLogEntry, BattleState, BattleUpdate, Side } from "./types"

const EMPTY: BattleState = { jaeger: 0, minttu: 0, version: 0, updatedAt: null }

function toState(row: typeof battle.$inferSelect): BattleState {
  return {
    jaeger: row.jaeger,
    minttu: row.minttu,
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** Current score. Public: the /battle screen shows it. */
export const getBattle = createServerFn({ method: "GET" }).handler(
  async (): Promise<BattleState> => {
    const [row] = await db.select().from(battle)
    return row ? toState(row) : EMPTY
  }
)

/** Recent hits, undos and resets, newest first. Admins only. */
export const getBattleLog = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async (): Promise<BattleLogEntry[]> => {
    const rows = await db
      .select()
      .from(battleEvents)
      .orderBy(desc(battleEvents.id))
      .limit(12)
    return rows.map((r) => ({ ...r, at: r.at.toISOString() }))
  })

const sideSchema = z.enum(["jaeger", "minttu"])

/**
 * Adds (`+1`) or takes back (`-1`) a point for one side, atomically so
 * simultaneous taps from several admins all count. Admins only.
 */
export const scoreBattle = createServerFn({ method: "POST" })
  .middleware([requireFeature("battle")])
  .validator(
    z.object({
      side: sideSchema,
      delta: z.union([z.literal(1), z.literal(-1)]),
    })
  )
  .handler(async ({ data, context }): Promise<BattleState> => {
    const col = data.side === "jaeger" ? battle.jaeger : battle.minttu
    const state = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(battle)
        .values({ id: 1, [data.side]: Math.max(0, data.delta), version: 1 })
        .onConflictDoUpdate({
          target: battle.id,
          set: {
            [data.side]: sql`greatest(${col} + ${data.delta}, 0)`,
            version: sql`${battle.version} + 1`,
            updatedAt: sql`now()`,
          },
        })
        .returning()
      await tx.insert(battleEvents).values({
        kind: data.delta > 0 ? "hit" : "undo",
        side: data.side as Side,
        by: context.user.kthid,
        byName: context.user.name,
      })
      return toState(row)
    })
    await publish({
      ...state,
      event: { kind: data.delta > 0 ? "hit" : "undo", side: data.side },
    } satisfies BattleUpdate)
    return state
  })

/** Sets both sides back to 0. Admins only. */
export const resetBattle = createServerFn({ method: "POST" })
  .middleware([requireFeature("battle")])
  .handler(async ({ context }): Promise<BattleState> => {
    const state = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(battle)
        .values({ id: 1, version: 1 })
        .onConflictDoUpdate({
          target: battle.id,
          set: {
            jaeger: 0,
            minttu: 0,
            version: sql`${battle.version} + 1`,
            updatedAt: sql`now()`,
          },
        })
        .returning()
      await tx.insert(battleEvents).values({
        kind: "reset",
        by: context.user.kthid,
        byName: context.user.name,
      })
      return toState(row)
    })
    await publish({ ...state, event: { kind: "reset", side: null } })
    return state
  })
