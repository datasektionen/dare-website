import { createServerFn } from "@tanstack/react-start"
import { count, desc, eq, gt, max, sql } from "drizzle-orm"
import { db } from "@/db"
import { battleEvents, featureChanges, ticketReleaseChanges } from "@/db/schema"
import { adminMiddleware } from "@/lib/auth/functions"
import type { BattleEventKind, Side } from "@/lib/battle/types"
import { type Feature, readFeatures } from "@/lib/settings/features.server"

export type Activity =
  | {
      type: "battle"
      id: string
      at: string
      by: string
      byName: string
      kind: BattleEventKind
      side: Side | null
    }
  | {
      type: "ticket-release"
      id: string
      at: string
      by: string
      byName: string
      releaseAt: string
    }
  | {
      type: "feature"
      id: string
      at: string
      by: string
      byName: string
      feature: Feature
      enabled: boolean
    }

/**
 * Everything admins have done, newest first. Events of features that are
 * switched off are left out. Admins only.
 */
export const getActivity = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async (): Promise<Activity[]> => {
    const features = await readFeatures()
    const [battle, releases, toggles] = await Promise.all([
      features.battle
        ? db
            .select()
            .from(battleEvents)
            .orderBy(desc(battleEvents.id))
            .limit(150)
        : [],
      !features.ticketRelease
        ? []
        : db
            .select()
            .from(ticketReleaseChanges)
            .orderBy(desc(ticketReleaseChanges.id))
            .limit(50),
      db
        .select()
        .from(featureChanges)
        .orderBy(desc(featureChanges.id))
        .limit(20),
    ])
    const items: Activity[] = [
      ...battle.map((e) => ({
        type: "battle" as const,
        id: `b${e.id}`,
        at: e.at.toISOString(),
        by: e.by,
        byName: e.byName,
        kind: e.kind,
        side: e.side,
      })),
      ...releases.map((c) => ({
        type: "ticket-release" as const,
        id: `t${c.id}`,
        at: c.changedAt.toISOString(),
        by: c.changedBy,
        byName: c.changedByName,
        releaseAt: c.releaseAt.toISOString(),
      })),
      ...toggles.map((f) => ({
        type: "feature" as const,
        id: `f${f.id}`,
        at: f.changedAt.toISOString(),
        by: f.changedBy,
        byName: f.changedByName,
        feature: f.feature,
        enabled: f.enabled,
      })),
    ]
    return items.sort((a, b) => b.at.localeCompare(a.at))
  })

export type BattleStats = {
  /** When the current round started (last reset), if ever reset. */
  roundStartedAt: string | null
  /** Points given per admin in the current round, most first. */
  judges: { by: string; byName: string; hits: number }[]
}

/** Who has given the most points this round. Admins only. */
export const getBattleStats = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async (): Promise<BattleStats> => {
    const [last] = await db
      .select({ at: max(battleEvents.at) })
      .from(battleEvents)
      .where(eq(battleEvents.kind, "reset"))
    const since = last?.at ?? null
    const judges = await db
      .select({
        by: battleEvents.by,
        byName: sql<string>`max(${battleEvents.byName})`,
        hits: count(),
      })
      .from(battleEvents)
      .where(
        since
          ? sql`${battleEvents.kind} = 'hit' and ${gt(battleEvents.at, since)}`
          : eq(battleEvents.kind, "hit")
      )
      .groupBy(battleEvents.by)
      .orderBy(desc(count()))
      .limit(8)
    return { roundStartedAt: since?.toISOString() ?? null, judges }
  })
