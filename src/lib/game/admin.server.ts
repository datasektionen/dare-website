import { setResponseStatus } from "@tanstack/react-start/server"
import { and, gt, isNull, or, sql } from "drizzle-orm"
import type { db } from "@/db"
import {
  gameAdminEvents,
  gameBans,
  type gameRuns,
  type gameScores,
  siteSettings,
} from "@/db/schema"
import type { SessionUser } from "@/lib/auth/types"
import { DEFAULT_TICKET_RELEASE } from "@/lib/ticket-release/constants"
import { TIME_ZONE } from "@/lib/time"
import { HOLD_FLAGS } from "./anticheat"

/*
 * Server-only helpers for the admin server functions in `./admin-functions`,
 * kept apart so none of this ends up in the browser bundle.
 */

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export function log(
  tx: Tx | typeof db,
  user: SessionUser,
  kind: (typeof gameAdminEvents.$inferInsert)["kind"],
  detail: string
) {
  return tx.insert(gameAdminEvents).values({
    kind,
    detail,
    by: user.kthid,
    byName: user.name,
  })
}

export function fail(status: number, message: string): never {
  setResponseStatus(status)
  throw new Error(message)
}

/** Runs flagged with something that holds them for review. */
export const holdFlagged = (
  flags: typeof gameScores.flags | typeof gameRuns.flags
) =>
  sql`${flags} && ${sql.raw(`ARRAY[${HOLD_FLAGS.map((f) => `'${f}'`).join(",")}]::text[]`)}`

/** Midnight today, Swedish time. */
export const today = sql`(date_trunc('day', now() at time zone ${TIME_ZONE}) at time zone ${TIME_ZONE})`

export const activeBan = () =>
  and(
    isNull(gameBans.liftedAt),
    or(isNull(gameBans.expiresAt), gt(gameBans.expiresAt, new Date()))
  )

export function banEnds(hours: number | null) {
  return hours === null ? null : new Date(Date.now() + hours * 3_600_000)
}

export async function saveSettings(
  tx: Tx,
  user: SessionUser,
  set: Partial<typeof siteSettings.$inferInsert>
) {
  await tx
    .insert(siteSettings)
    .values({
      id: 1,
      ticketReleaseAt: new Date(DEFAULT_TICKET_RELEASE),
      ...set,
      updatedBy: user.kthid,
    })
    .onConflictDoUpdate({
      target: siteSettings.id,
      set: { ...set, updatedAt: new Date(), updatedBy: user.kthid },
    })
}
