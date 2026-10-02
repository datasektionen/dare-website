import { createHmac, randomBytes, randomInt, randomUUID } from "node:crypto"
import { getRequestIP, setResponseStatus } from "@tanstack/react-start/server"
import { and, eq, gt, isNull, or } from "drizzle-orm"
import { db } from "@/db"
import { gameBans } from "@/db/schema"
import { readFeatures } from "@/lib/settings/features.server"

/*
 * Server-only helpers for the players' server functions in `./functions`,
 * kept apart so none of this ends up in the browser bundle.
 */

export async function requireGame() {
  if (!(await readFeatures()).puckopist) {
    setResponseStatus(409)
    throw new Error("Puckopist är avstängt.")
  }
}

export function fail(status: number, message: string): never {
  setResponseStatus(status)
  throw new Error(message)
}

export function requestIP() {
  return getRequestIP({ xForwardedFor: true }) ?? null
}

export type Ban = typeof gameBans.$inferSelect

/** Bans in force against this player (and, if given, the name). */
export async function bansFor(
  who: { device: string; fingerprint: string | null; ip: string | null },
  name?: string
): Promise<Ban[]> {
  const matches = [
    and(eq(gameBans.kind, "device"), eq(gameBans.value, who.device)),
    who.fingerprint
      ? and(
          eq(gameBans.kind, "fingerprint"),
          eq(gameBans.value, who.fingerprint)
        )
      : undefined,
    who.ip
      ? and(eq(gameBans.kind, "ip"), eq(gameBans.value, who.ip))
      : undefined,
    name ? eq(gameBans.kind, "name") : undefined,
  ]
  const rows = await db
    .select()
    .from(gameBans)
    .where(
      and(
        isNull(gameBans.liftedAt),
        or(isNull(gameBans.expiresAt), gt(gameBans.expiresAt, new Date())),
        or(...matches)
      )
    )
  const lower = name?.toLowerCase()
  return rows.filter((b) => b.kind !== "name" || lower?.includes(b.value))
}

/** A hard ban beats a shadow ban. */
export function verdict(bans: Ban[]) {
  if (bans.some((b) => !b.shadow)) return "block" as const
  return bans.length ? ("shadow" as const) : null
}

export function hmac(key: string, message: string) {
  return createHmac("sha256", Buffer.from(key, "hex"))
    .update(message)
    .digest("hex")
}

/** A new run's id, the seed of its piste, and the key for its checksum. */
export function newTicket() {
  return {
    runId: randomUUID(),
    seed: randomInt(1, 2 ** 31 - 1),
    key: randomBytes(32).toString("hex"),
  }
}
