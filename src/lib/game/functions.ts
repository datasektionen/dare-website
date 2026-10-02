import { createServerFn } from "@tanstack/react-start"
import { setResponseStatus } from "@tanstack/react-start/server"
import { and, asc, count, desc, eq, gt, ilike, lt, or, sql } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import { gameScoreRemovals, gameScores } from "@/db/schema"
import { adminMiddleware } from "@/lib/auth/functions"
import { type AdminScores, containsPattern, PAGE_SIZE } from "./admin"
import {
  cleanName,
  isPlausible,
  LEADERBOARD_SIZE,
  NAME_MAX,
  type ScoreEntry,
} from "./leaderboard"
import { allowSubmission } from "./rate-limit.server"

/** The best runs, highest first; ties go to whoever got there first. Public. */
export const getLeaderboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<ScoreEntry[]> => {
    const rows = await db
      .select()
      .from(gameScores)
      .orderBy(desc(gameScores.score), asc(gameScores.at), asc(gameScores.id))
      .limit(LEADERBOARD_SIZE)
    return rows.map((r, i) => ({ ...r, rank: i + 1, at: r.at.toISOString() }))
  }
)

const count0 = z.number().int().min(0)

/**
 * Saves a run under a typed-in name and returns its place. Public, so
 * anyone can play without logging in; scores are sanity-checked and
 * rate-limited.
 */
export const submitScore = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        name: z
          .string()
          .max(200)
          .transform(cleanName)
          .pipe(z.string().min(1, "Skriv ett namn.").max(NAME_MAX)),
        score: count0.max(10_000_000),
        cans: count0.max(1_000_000),
        distance: count0.max(1_000_000),
      })
      .refine(isPlausible, "Det där resultatet går inte att få.")
  )
  .handler(async ({ data }): Promise<{ id: number; rank: number }> => {
    if (!allowSubmission()) {
      setResponseStatus(429)
      throw new Error("För många försök. Vänta en stund.")
    }
    const [row] = await db.insert(gameScores).values(data).returning()
    const [{ ahead }] = await db
      .select({ ahead: count() })
      .from(gameScores)
      .where(
        or(
          gt(gameScores.score, row.score),
          and(eq(gameScores.score, row.score), lt(gameScores.at, row.at))
        )
      )
    return { id: row.id, rank: ahead + 1 }
  })

/**
 * All saved runs with their place on the leaderboard, best first, optionally
 * only those whose name contains `q`. Admins only.
 */
export const getScores = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator(
    z.object({
      q: z.string().trim().max(200).default(""),
      limit: z.number().int().min(1).max(1000).default(PAGE_SIZE),
    })
  )
  .handler(async ({ data }): Promise<AdminScores> => {
    // Rank everything first, so a search still shows each run's real place.
    const ranked = db.$with("ranked").as(
      db
        .select({
          id: gameScores.id,
          name: gameScores.name,
          score: gameScores.score,
          cans: gameScores.cans,
          distance: gameScores.distance,
          at: gameScores.at,
          rank: sql<number>`row_number() over (order by ${gameScores.score} desc, ${gameScores.at} asc, ${gameScores.id} asc)`
            .mapWith(Number)
            .as("rank"),
          sameName:
            sql<number>`count(*) over (partition by lower(${gameScores.name}))`
              .mapWith(Number)
              .as("same_name"),
          total: sql<number>`count(*) over ()`.mapWith(Number).as("total"),
        })
        .from(gameScores)
    )
    const rows = await db
      .with(ranked)
      .select({
        id: ranked.id,
        name: ranked.name,
        score: ranked.score,
        cans: ranked.cans,
        distance: ranked.distance,
        at: ranked.at,
        rank: ranked.rank,
        sameName: ranked.sameName,
        total: ranked.total,
        matching: sql<number>`count(*) over ()`.mapWith(Number),
      })
      .from(ranked)
      .where(data.q ? ilike(ranked.name, containsPattern(data.q)) : undefined)
      .orderBy(ranked.rank)
      .limit(data.limit)
    // `total` is counted before the search; without matches, count again.
    const total =
      rows[0]?.total ??
      (data.q ? (await db.select({ n: count() }).from(gameScores))[0].n : 0)
    return {
      entries: rows.map(({ total: _, matching: __, ...r }) => ({
        ...r,
        at: new Date(r.at).toISOString(),
      })),
      matching: rows[0]?.matching ?? 0,
      total,
    }
  })

/**
 * Removes one run, or every run under a name (ignoring case), and logs who
 * did it. Returns how many runs were removed. Admins only.
 */
export const removeScores = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(
    z.union([
      z.object({ id: z.number().int() }),
      z.object({ name: z.string().min(1).max(200) }),
    ])
  )
  .handler(async ({ data, context }): Promise<{ removed: number }> => {
    return db.transaction(async (tx) => {
      const rows = await tx
        .delete(gameScores)
        .where(
          "id" in data
            ? eq(gameScores.id, data.id)
            : eq(sql`lower(${gameScores.name})`, sql`lower(${data.name})`)
        )
        .returning()
      if (!rows.length) return { removed: 0 }
      const best = rows.reduce((a, b) => (b.score > a.score ? b : a))
      await tx.insert(gameScoreRemovals).values({
        name: best.name,
        runs: rows.length,
        bestScore: best.score,
        removedBy: context.user.kthid,
        removedByName: context.user.name,
      })
      return { removed: rows.length }
    })
  })
