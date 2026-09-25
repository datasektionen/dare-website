import { eq } from "drizzle-orm"
import { db } from "@/db"
import { siteSettings } from "@/db/schema"

/** Optional parts of the site that admins can switch on and off. */
export type Features = {
  /** Jäger vs Minttu: /battle, its dashboard page and scoring. */
  battle: boolean
  /** Ticket release countdown: its dashboard page and the landing numbers. */
  ticketRelease: boolean
}
export type Feature = keyof Features

/** Used when no settings have been saved yet. */
export const DEFAULT_FEATURES: Features = { battle: false, ticketRelease: true }

/**
 * Which optional features are on. Server-only (it queries the database), for
 * use inside server function handlers and middleware.
 */
export async function readFeatures(): Promise<Features> {
  const [row] = await db
    .select({
      battle: siteSettings.battleEnabled,
      ticketRelease: siteSettings.ticketReleaseEnabled,
    })
    .from(siteSettings)
    .where(eq(siteSettings.id, 1))
  return row ?? DEFAULT_FEATURES
}
