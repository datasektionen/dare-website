import { createServerFn } from "@tanstack/react-start"
import { asc, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import { battleJudgeChanges, battleJudges } from "@/db/schema"
import { requireFeature } from "@/lib/settings/functions"
import { type AddedJudges, type Judge, parseKthIds } from "./judges"
import { lookupNames } from "./judges.server"

const toJudge = (r: typeof battleJudges.$inferSelect): Judge => ({
  kthid: r.kthid,
  name: r.name,
  addedByName: r.addedByName,
  addedAt: r.addedAt.toISOString(),
})

/** Everyone who may score the battle besides admins. Admins only. */
export const getJudges = createServerFn({ method: "GET" })
  .middleware([requireFeature("battle")])
  .handler(async (): Promise<Judge[]> => {
    const rows = await db
      .select()
      .from(battleJudges)
      .orderBy(asc(battleJudges.name), asc(battleJudges.kthid))
    return rows.map(toJudge)
  })

/**
 * Makes KTH ids judges, from typed or pasted text, and logs it. Ids SSO
 * doesn't know are skipped. Admins only.
 */
export const addJudges = createServerFn({ method: "POST" })
  .middleware([requireFeature("battle")])
  .validator(z.object({ text: z.string().max(5000) }))
  .handler(async ({ data, context }): Promise<AddedJudges> => {
    const { ids, invalid } = parseKthIds(data.text)
    if (!ids.length) return { added: [], already: [], unknown: [], invalid }
    const existing = await db
      .select({ kthid: battleJudges.kthid })
      .from(battleJudges)
      .where(inArray(battleJudges.kthid, ids))
    const already = existing.map((r) => r.kthid)
    const fresh = ids.filter((id) => !already.includes(id))
    const names = await lookupNames(fresh)
    const unknown = fresh.filter((id) => names.get(id) === null)
    const adding = fresh.filter((id) => names.get(id) !== null)
    const added = !adding.length
      ? []
      : await db.transaction(async (tx) => {
          const rows = await tx
            .insert(battleJudges)
            .values(
              adding.map((kthid) => ({
                kthid,
                name: names.get(kthid) ?? null,
                addedBy: context.user.kthid,
                addedByName: context.user.name,
              }))
            )
            .onConflictDoNothing()
            .returning()
          if (rows.length)
            await tx.insert(battleJudgeChanges).values(
              rows.map((r) => ({
                kthid: r.kthid,
                name: r.name,
                added: true,
                changedBy: context.user.kthid,
                changedByName: context.user.name,
              }))
            )
          return rows
        })
    return { added: added.map(toJudge), already, unknown, invalid }
  })

/** Takes away someone's right to score, and logs it. Admins only. */
export const removeJudge = createServerFn({ method: "POST" })
  .middleware([requireFeature("battle")])
  .validator(z.object({ kthid: z.string().min(1).max(32) }))
  .handler(async ({ data, context }): Promise<{ removed: boolean }> => {
    return db.transaction(async (tx) => {
      const [row] = await tx
        .delete(battleJudges)
        .where(eq(battleJudges.kthid, data.kthid))
        .returning()
      if (!row) return { removed: false }
      await tx.insert(battleJudgeChanges).values({
        kthid: row.kthid,
        name: row.name,
        added: false,
        changedBy: context.user.kthid,
        changedByName: context.user.name,
      })
      return { removed: true }
    })
  })
