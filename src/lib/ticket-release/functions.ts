import { createServerFn } from "@tanstack/react-start"
import { desc, eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import { siteSettings, ticketReleaseChanges } from "@/db/schema"
import { adminMiddleware } from "@/lib/auth/functions"
import { requireFeature } from "@/lib/settings/functions"

import { DEFAULT_TICKET_RELEASE } from "./constants"

export { DEFAULT_TICKET_RELEASE }

export type TicketRelease = {
  /** ISO timestamp. */
  at: string
  updatedAt: string | null
  updatedBy: string | null
}

export type TicketReleaseChange = {
  id: number
  releaseAt: string
  changedBy: string
  changedByName: string
  changedAt: string
}

/** When ticket sales open. Public: the landing page counts down to it. */
export const getTicketRelease = createServerFn({ method: "GET" }).handler(
  async (): Promise<TicketRelease> => {
    const [row] = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.id, 1))
    if (!row)
      return { at: DEFAULT_TICKET_RELEASE, updatedAt: null, updatedBy: null }
    return {
      at: row.ticketReleaseAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      updatedBy: row.updatedBy,
    }
  }
)

/** Recent changes to the release time, newest first. Admins only. */
export const getTicketReleaseHistory = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async (): Promise<TicketReleaseChange[]> => {
    const rows = await db
      .select()
      .from(ticketReleaseChanges)
      .orderBy(desc(ticketReleaseChanges.changedAt))
      .limit(8)
    return rows.map((r) => ({
      ...r,
      releaseAt: r.releaseAt.toISOString(),
      changedAt: r.changedAt.toISOString(),
    }))
  })

/** Sets when ticket sales open, and logs who changed it. Admins only. */
export const setTicketRelease = createServerFn({ method: "POST" })
  .middleware([requireFeature("ticketRelease")])
  .validator(z.object({ at: z.iso.datetime() }))
  .handler(async ({ data, context }): Promise<TicketRelease> => {
    const at = new Date(data.at)
    const now = new Date()
    await db.transaction(async (tx) => {
      await tx
        .insert(siteSettings)
        .values({
          id: 1,
          ticketReleaseAt: at,
          updatedAt: now,
          updatedBy: context.user.kthid,
        })
        .onConflictDoUpdate({
          target: siteSettings.id,
          set: {
            ticketReleaseAt: at,
            updatedAt: now,
            updatedBy: context.user.kthid,
          },
        })
      await tx.insert(ticketReleaseChanges).values({
        releaseAt: at,
        changedBy: context.user.kthid,
        changedByName: context.user.name,
        changedAt: now,
      })
    })
    return {
      at: at.toISOString(),
      updatedAt: now.toISOString(),
      updatedBy: context.user.kthid,
    }
  })
