import { eq } from "drizzle-orm"
import { db } from "@/db"
import { battleJudges } from "@/db/schema"
import { env } from "@/env"

/** Whether `kthid` may score the battle (admins aside). */
export async function isJudge(kthid: string) {
  const [row] = await db
    .select({ kthid: battleJudges.kthid })
    .from(battleJudges)
    .where(eq(battleJudges.kthid, kthid))
  return !!row
}

/**
 * Names for KTH ids from SSO's internal API: a name, `null` for ids SSO
 * doesn't know, or `undefined` when it couldn't be asked (no `SSO_API_URL`,
 * or it didn't answer), in which case the id is taken on trust.
 */
export async function lookupNames(kthids: string[]) {
  const names = new Map<string, string | null | undefined>()
  await Promise.all(
    kthids.map(async (kthid) => {
      if (!env.SSO_API_URL) return names.set(kthid, undefined)
      try {
        const res = await fetch(
          `${env.SSO_API_URL}/api/users?format=single&u=${encodeURIComponent(kthid)}`,
          { signal: AbortSignal.timeout(3000) }
        )
        if (res.status === 404) return names.set(kthid, null)
        if (!res.ok) return names.set(kthid, undefined)
        const u: { firstName?: string; familyName?: string } = await res.json()
        const name = [u.firstName, u.familyName].filter(Boolean).join(" ")
        names.set(kthid, name || undefined)
      } catch {
        names.set(kthid, undefined)
      }
    })
  )
  return names
}

/** Fills in a judge's name when they log in, if it wasn't known. */
export async function rememberJudgeName(kthid: string, name: string) {
  if (!name) return
  await db
    .update(battleJudges)
    .set({ name })
    .where(eq(battleJudges.kthid, kthid))
}
