import { createMiddleware, createServerFn } from "@tanstack/react-start"
import { setResponseStatus } from "@tanstack/react-start/server"
import { z } from "zod"
import { db } from "@/db"
import { featureChanges, siteSettings } from "@/db/schema"
import { adminMiddleware } from "@/lib/auth/functions"
import { DEFAULT_TICKET_RELEASE } from "@/lib/ticket-release/constants"
import {
  DEFAULT_FEATURES,
  type Feature,
  type Features,
  readFeatures,
} from "./features.server"
import { FEATURE_NAMES } from "./names"

export type { Feature, Features } from "./features.server"

const COLUMNS = {
  battle: "battleEnabled",
  ticketRelease: "ticketReleaseEnabled",
} as const satisfies Record<Feature, keyof typeof siteSettings.$inferInsert>

/**
 * Server function middleware: admin-only, and refuses while `feature` is
 * switched off.
 */
export function requireFeature(feature: Feature) {
  return createMiddleware({ type: "function" })
    .middleware([adminMiddleware])
    .server(async ({ next }) => {
      if (!(await readFeatures())[feature]) {
        setResponseStatus(409)
        throw new Error(
          `${FEATURE_NAMES[feature]} är avstängt. Slå på det under Inställningar.`
        )
      }
      return next()
    })
}

/** Which optional features are switched on. Public (the site needs it). */
export const getFeatures = createServerFn({ method: "GET" }).handler(() =>
  readFeatures()
)

/** Switches an optional feature on or off, and logs it. Admins only. */
export const setFeature = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(
    z.object({
      feature: z.enum(["battle", "ticketRelease"]),
      enabled: z.boolean(),
    })
  )
  .handler(async ({ data, context }): Promise<Features> => {
    const column = COLUMNS[data.feature]
    const [row] = await db.transaction(async (tx) => {
      const rows = await tx
        .insert(siteSettings)
        .values({
          id: 1,
          ticketReleaseAt: new Date(DEFAULT_TICKET_RELEASE),
          battleEnabled: DEFAULT_FEATURES.battle,
          ticketReleaseEnabled: DEFAULT_FEATURES.ticketRelease,
          [column]: data.enabled,
          updatedBy: context.user.kthid,
        })
        .onConflictDoUpdate({
          target: siteSettings.id,
          set: {
            [column]: data.enabled,
            updatedAt: new Date(),
            updatedBy: context.user.kthid,
          },
        })
        .returning({
          battle: siteSettings.battleEnabled,
          ticketRelease: siteSettings.ticketReleaseEnabled,
        })
      await tx.insert(featureChanges).values({
        feature: data.feature,
        enabled: data.enabled,
        changedBy: context.user.kthid,
        changedByName: context.user.name,
      })
      return rows
    })
    return row
  })
