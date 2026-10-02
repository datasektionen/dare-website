import { createServerFn } from "@tanstack/react-start"
import { desc, sql } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import { battle, battleEvents } from "@/db/schema"
import { requireFeature } from "@/lib/settings/functions"
import { judgeMiddleware } from "./access"
import { publish } from "./bus.server"
import { readBattle, toState } from "./state.server"
import type { BattleLogEntry, BattleState, BattleUpdate, Side } from "./types"

/** Current score. Public: the /battle screen shows it. */
export const getBattle = createServerFn({ method: "GET" }).handler(() =>
  readBattle()
)

/** Recent hits, undos and resets, newest first. Admins and judges. */
export const getBattleLog = createServerFn({ method: "GET" })
  .middleware([judgeMiddleware])
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
 * simultaneous taps from several people all count. Admins and judges.
 */
export const scoreBattle = createServerFn({ method: "POST" })
  .middleware([judgeMiddleware])
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
