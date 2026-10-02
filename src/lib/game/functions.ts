import { createServerFn } from "@tanstack/react-start"
import { and, asc, count, desc, eq, gt, isNull, lt, ne, or } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import { gameRuns, gameScores } from "@/db/schema"
import { readFeatures } from "@/lib/settings/features.server"
import {
  CLIENT_FLAGS,
  checkTiming,
  macMessage,
  SAVE_TTL_MS,
  shouldHold,
  TICKET_TTL_MS,
} from "./anticheat"
import type { GameFlag } from "./constants"
import { getDevice } from "./device.server"
import {
  cleanName,
  LEADERBOARD_SIZE,
  NAME_MAX,
  type ScoreEntry,
} from "./leaderboard"
import {
  bansFor,
  fail,
  hmac,
  newTicket,
  requestIP,
  requireGame,
  verdict,
} from "./players.server"
import { MAX_TICKS, replay, TICK_RATE, unpackInputs } from "./puckopist"
import { allowPlayer } from "./rate-limit.server"
import { onLeaderboard, readGameSettings } from "./settings.server"

/** Whether the start page links to the game in its menu. Public. */
export const getGameLink = createServerFn({ method: "GET" }).handler(
  async (): Promise<boolean> => {
    if (!(await readFeatures()).puckopist) return false
    return (await readGameSettings()).inNav
  }
)

/** The best runs, highest first; ties go to whoever got there first. Public. */
export const getLeaderboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<ScoreEntry[]> => {
    await requireGame()
    const { since } = await readGameSettings()
    const rows = await db
      .select({
        id: gameScores.id,
        name: gameScores.name,
        score: gameScores.score,
        cans: gameScores.cans,
        distance: gameScores.distance,
        at: gameScores.at,
      })
      .from(gameScores)
      .where(onLeaderboard(since))
      .orderBy(desc(gameScores.score), asc(gameScores.at), asc(gameScores.id))
      .limit(LEADERBOARD_SIZE)
    return rows.map((r, i) => ({ ...r, rank: i + 1, at: r.at.toISOString() }))
  }
)

export type Ticket =
  | { runId: string; seed: number; key: string; saving: boolean }
  | { blocked: true }

const fingerprint = z
  .string()
  .regex(/^[0-9a-f]{64}$/)
  .nullable()

/**
 * Hands out a ticket for one run: the piste's seed and the key for its
 * checksum. Fetched before the player sets off, so starting is instant.
 * Public; banned players get no ticket and ride without saving.
 */
export const startRun = createServerFn({ method: "POST" })
  .validator(z.object({ fingerprint }))
  .handler(async ({ data }): Promise<Ticket> => {
    await requireGame()
    const device = await getDevice()
    const ip = requestIP()
    if (!allowPlayer("start", device, ip, 30))
      fail(429, "För många försök. Vänta en stund.")
    const who = { device, fingerprint: data.fingerprint, ip }
    if (verdict(await bansFor(who)) === "block") return { blocked: true }
    const { saving } = await readGameSettings()
    const { runId, seed, key } = newTicket()
    await db.insert(gameRuns).values({ id: runId, seed, key, ...who })
    // Now and then, forget tickets nobody used and runs nobody saved.
    if (Math.random() < 0.02)
      await db
        .delete(gameRuns)
        .where(
          and(
            ne(gameRuns.status, "saved"),
            lt(gameRuns.issuedAt, new Date(Date.now() - 7 * 86_400_000))
          )
        )
    return { runId, seed, key, saving }
  })

/** Marks when the player actually set off on a ticket. Public. */
export const beginRun = createServerFn({ method: "POST" })
  .validator(z.object({ runId: z.uuid() }))
  .handler(async ({ data }) => {
    const device = await getDevice()
    await db
      .update(gameRuns)
      .set({ startedAt: new Date() })
      .where(
        and(
          eq(gameRuns.id, data.runId),
          eq(gameRuns.device, device),
          eq(gameRuns.status, "issued"),
          isNull(gameRuns.startedAt)
        )
      )
  })

const count0 = z.number().int().min(0)
/** The longest a run can take. */
const RUN_MS = (MAX_TICKS / TICK_RATE) * 1000

export type Verified =
  | { ok: true; score: number; cans: number; distance: number }
  | { ok: false; reason: "expired" | "fast" }

/**
 * Checks a finished run by replaying its presses on its piste, and keeps the
 * server's own score for saving. Public, once per ticket.
 */
export const finishRun = createServerFn({ method: "POST" })
  .validator(
    z.object({
      runId: z.uuid(),
      ticks: z.number().int().min(1).max(MAX_TICKS),
      /** The run's `inputs`, packed. */
      inputs: z.array(count0.max(MAX_TICKS * 4)).max(80_000),
      digest: count0.max(2 ** 32 - 1),
      score: count0.max(100_000_000),
      cans: count0.max(1_000_000),
      distance: count0.max(1_000_000),
      mac: z.union([z.string().regex(/^[0-9a-f]{64}$/), z.literal("")]),
      flags: z.array(z.enum(CLIENT_FLAGS)).max(CLIENT_FLAGS.length),
    })
  )
  .handler(async ({ data }): Promise<Verified> => {
    const device = await getDevice()
    if (!allowPlayer("finish", device, requestIP(), 30))
      fail(429, "För många försök. Vänta en stund.")
    // Claim the ticket first, so it can only ever be used once.
    const [run] = await db
      .update(gameRuns)
      .set({ status: "rejected", finishedAt: new Date() })
      .where(
        and(
          eq(gameRuns.id, data.runId),
          eq(gameRuns.device, device),
          eq(gameRuns.status, "issued")
        )
      )
      .returning()
    if (!run) fail(409, "Åket finns inte eller är redan inskickat.")
    const now = run.finishedAt ?? new Date()
    const started = run.startedAt ?? run.issuedAt
    const reject = async (reason: "expired" | "fast") => {
      await db
        .update(gameRuns)
        .set({ rejected: reason, ticks: data.ticks })
        .where(eq(gameRuns.id, run.id))
      return { ok: false as const, reason }
    }
    if (run.issuedAt.getTime() < now.getTime() - TICKET_TTL_MS - RUN_MS)
      return reject("expired")
    // Before replaying, so made-up runs cost the server nothing.
    if (checkTiming(data.ticks, now.getTime() - started.getTime()) === "fast")
      return reject("fast")

    const inputs = unpackInputs(data.inputs)
    // A little past the claimed crash, in case the claim is short.
    const limit = Math.min(MAX_TICKS, data.ticks + TICK_RATE * 2)
    const { run: sim, extra } = replay(run.seed, inputs, limit)
    const result = { score: sim.score, cans: sim.cans, distance: sim.distance }

    const flags = new Set<GameFlag>(data.flags)
    if (checkTiming(sim.ticks, now.getTime() - started.getTime()) === "slow")
      flags.add("slow")
    const expected = hmac(
      run.key,
      macMessage({ ...data, runId: run.id, inputs: data.inputs })
    )
    if (!data.mac) flags.add("nomac")
    if (
      (data.mac && data.mac !== expected) ||
      extra > 0 ||
      sim.status !== "crashed" ||
      sim.ticks !== data.ticks ||
      sim.digest !== data.digest ||
      result.score !== data.score ||
      result.cans !== data.cans ||
      result.distance !== data.distance
    )
      flags.add("mismatch")

    await db
      .update(gameRuns)
      .set({
        status: "finished",
        ticks: sim.ticks,
        ...result,
        flags: [...flags],
      })
      .where(eq(gameRuns.id, run.id))
    return { ok: true, ...result }
  })

export type Saved = {
  id: number
  /** Null while it waits for an admin to approve it. */
  rank: number | null
  held: boolean
}

/**
 * Saves a checked run to the leaderboard under a typed-in name and returns
 * its place. Public, so anyone can play without logging in. The score is the
 * one from the server's replay; nothing about it is taken from the browser.
 */
export const submitScore = createServerFn({ method: "POST" })
  .validator(
    z.object({
      runId: z.uuid(),
      name: z
        .string()
        .max(200)
        .transform(cleanName)
        .pipe(z.string().min(1, "Skriv ett namn.").max(NAME_MAX)),
    })
  )
  .handler(async ({ data }): Promise<Saved> => {
    await requireGame()
    const device = await getDevice()
    const ip = requestIP()
    if (!allowPlayer("save", device, ip, 10))
      fail(429, "För många försök. Vänta en stund.")
    const settings = await readGameSettings()
    if (!settings.saving) fail(409, "Topplistan är stängd just nu.")

    const [run] = await db
      .select()
      .from(gameRuns)
      .where(and(eq(gameRuns.id, data.runId), eq(gameRuns.device, device)))
    if (
      run?.status !== "finished" ||
      run.score === null ||
      !run.finishedAt ||
      run.finishedAt.getTime() < Date.now() - SAVE_TTL_MS
    )
      fail(409, "Åket kan inte sparas.")

    const ban = verdict(
      await bansFor(
        { device, fingerprint: run.fingerprint, ip: ip ?? run.ip },
        data.name
      )
    )
    if (ban === "block") fail(403, "Du kan inte spara på topplistan.")
    const held = settings.holdFlagged && shouldHold(run.flags)
    const status = ban === "shadow" ? "shadow" : held ? "held" : "visible"

    const row = await db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(gameRuns)
        .set({ status: "saved" })
        .where(and(eq(gameRuns.id, run.id), eq(gameRuns.status, "finished")))
        .returning({ id: gameRuns.id })
      if (!claimed) return null
      const [row] = await tx
        .insert(gameScores)
        .values({
          name: data.name,
          score: run.score ?? 0,
          cans: run.cans ?? 0,
          distance: run.distance ?? 0,
          runId: run.id,
          device,
          fingerprint: run.fingerprint,
          ip,
          status,
          flags: run.flags,
        })
        .returning()
      return row
    })
    if (!row) fail(409, "Åket är redan sparat.")
    // A shadow-banned player sees the place they would have had.
    if (status === "held") return { id: row.id, rank: null, held: true }
    const [{ ahead }] = await db
      .select({ ahead: count() })
      .from(gameScores)
      .where(
        and(
          onLeaderboard(settings.since),
          ne(gameScores.id, row.id),
          or(
            gt(gameScores.score, row.score),
            and(eq(gameScores.score, row.score), lt(gameScores.at, row.at))
          )
        )
      )
    return { id: row.id, rank: ahead + 1, held: false }
  })
