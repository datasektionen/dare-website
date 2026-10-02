import { createServerFn } from "@tanstack/react-start"
import { desc, eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import {
  siteSettings,
  ticketReleaseChanges,
  ticketUrlChanges,
} from "@/db/schema"
import { adminMiddleware } from "@/lib/auth/functions"
import { requireFeature } from "@/lib/settings/functions"

import { DEFAULT_TICKET_RELEASE } from "./constants"
import { ticketUrlSchema } from "./schema"

export { DEFAULT_TICKET_RELEASE }

export type TicketRelease = {
  /** ISO timestamp. */
  at: string
  updatedAt: string | null
  updatedBy: string | null
}

/** One entry in the ticket release change log. */
export type TicketReleaseChange = {
  id: string
  changedBy: string
  changedByName: string
  changedAt: string
} & (
  | { kind: "time"; releaseAt: string }
  /** `url` null means the link was removed. */
  | { kind: "link"; url: string | null }
)

/**
 * The ticket link as the public sees it. The URL is only sent once the
 * release time has passed, checked here on the server.
 */
export type TicketLink =
  | { state: "upcoming" }
  /** Released, but no admin has set a link yet. */
  | { state: "missing" }
  | { state: "open"; url: string }

/** The ticket link for the dashboard, released or not. Admins only. */
export type TicketLinkAdmin = {
  url: string | null
  updatedAt: string | null
  updatedBy: string | null
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

/** The ticket link, but only once tickets are released. Public. */
export const getTicketLink = createServerFn({ method: "GET" }).handler(
  async (): Promise<TicketLink> => {
    const [row] = await db
      .select({
        at: siteSettings.ticketReleaseAt,
        url: siteSettings.ticketUrl,
      })
      .from(siteSettings)
      .where(eq(siteSettings.id, 1))
    const at = row?.at ?? new Date(DEFAULT_TICKET_RELEASE)
    if (Date.now() < at.getTime()) return { state: "upcoming" }
    return row?.url ? { state: "open", url: row.url } : { state: "missing" }
  }
)

/** The ticket link before release too, for editing it. Admins only. */
export const getTicketLinkAdmin = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async (): Promise<TicketLinkAdmin> => {
    const [row] = await db
      .select({
        url: siteSettings.ticketUrl,
        updatedAt: siteSettings.ticketUrlUpdatedAt,
        updatedBy: siteSettings.ticketUrlUpdatedBy,
      })
      .from(siteSettings)
      .where(eq(siteSettings.id, 1))
    return {
      url: row?.url ?? null,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
      updatedBy: row?.updatedBy ?? null,
    }
  })

/**
 * Recent changes to the release time and ticket link, newest first. Admins
 * only.
 */
export const getTicketReleaseHistory = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async (): Promise<TicketReleaseChange[]> => {
    const [times, links] = await Promise.all([
      db
        .select()
        .from(ticketReleaseChanges)
        .orderBy(desc(ticketReleaseChanges.changedAt))
        .limit(10),
      db
        .select()
        .from(ticketUrlChanges)
        .orderBy(desc(ticketUrlChanges.changedAt))
        .limit(10),
    ])
    const entries: TicketReleaseChange[] = [
      ...times.map((r) => ({
        kind: "time" as const,
        id: `t${r.id}`,
        releaseAt: r.releaseAt.toISOString(),
        changedBy: r.changedBy,
        changedByName: r.changedByName,
        changedAt: r.changedAt.toISOString(),
      })),
      ...links.map((r) => ({
        kind: "link" as const,
        id: `l${r.id}`,
        url: r.url,
        changedBy: r.changedBy,
        changedByName: r.changedByName,
        changedAt: r.changedAt.toISOString(),
      })),
    ]
    return entries
      .sort((a, b) => b.changedAt.localeCompare(a.changedAt))
      .slice(0, 10)
  })

/** Sets (or with `null`, removes) the ticket link, and logs it. Admins only. */
export const setTicketLink = createServerFn({ method: "POST" })
  .middleware([requireFeature("ticketRelease")])
  .validator(z.object({ url: ticketUrlSchema.nullable() }))
  .handler(async ({ data, context }): Promise<TicketLinkAdmin> => {
    const now = new Date()
    const values = {
      ticketUrl: data.url,
      ticketUrlUpdatedAt: now,
      ticketUrlUpdatedBy: context.user.kthid,
    }
    await db.transaction(async (tx) => {
      await tx
        .insert(siteSettings)
        .values({
          id: 1,
          ticketReleaseAt: new Date(DEFAULT_TICKET_RELEASE),
          ...values,
        })
        .onConflictDoUpdate({ target: siteSettings.id, set: values })
      await tx.insert(ticketUrlChanges).values({
        url: data.url,
        changedBy: context.user.kthid,
        changedByName: context.user.name,
        changedAt: now,
      })
    })
    return {
      url: data.url,
      updatedAt: now.toISOString(),
      updatedBy: context.user.kthid,
    }
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
