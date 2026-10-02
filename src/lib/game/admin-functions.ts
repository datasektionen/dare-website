import { createServerFn } from "@tanstack/react-start"
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import { gameBans, gameRuns, gameScoreRemovals, gameScores } from "@/db/schema"
import { requireFeature } from "@/lib/settings/functions"
import {
  type AdminBan,
  type AdminScores,
  containsPattern,
  describeDuration,
  type GameOverview,
  PAGE_SIZE,
  SCORE_VIEWS,
  type ScoreView,
} from "./admin"
import {
  activeBan,
  banEnds,
  fail,
  holdFlagged,
  log,
  saveSettings,
  today,
} from "./admin.server"
import { BAN_LABELS } from "./anticheat"
import { BAN_KINDS } from "./constants"
import { TICK_RATE } from "./puckopist"
import { onLeaderboard, readGameSettings } from "./settings.server"

const admin = requireFeature("puckopist")

const points = (n: number) => `${n.toLocaleString("sv-SE")} p`

/** Settings, today's numbers and bans for the dashboard. Admins only. */
export const getGameOverview = createServerFn({ method: "GET" })
  .middleware([admin])
  .handler(async (): Promise<GameOverview> => {
    const settings = await readGameSettings()
    const board = onLeaderboard(settings.since)
    const [[day], [scores], [best], bans] = await Promise.all([
      db
        .select({
          runs: sql<number>`count(*) filter (where ${gameRuns.status} in ('finished', 'saved'))`.mapWith(
            Number
          ),
          players:
            sql<number>`count(distinct ${gameRuns.device}) filter (where ${gameRuns.status} in ('finished', 'saved'))`.mapWith(
              Number
            ),
          rejected:
            sql<number>`count(*) filter (where ${gameRuns.status} = 'rejected')`.mapWith(
              Number
            ),
          flagged:
            sql<number>`count(*) filter (where ${holdFlagged(gameRuns.flags)})`.mapWith(
              Number
            ),
        })
        .from(gameRuns)
        .where(gte(gameRuns.finishedAt, today)),
      db
        .select({
          saved: sql<number>`count(*) filter (where ${board})`.mapWith(Number),
          held: sql<number>`count(*) filter (where ${gameScores.status} = 'held')`.mapWith(
            Number
          ),
        })
        .from(gameScores),
      db
        .select({ name: gameScores.name, score: gameScores.score })
        .from(gameScores)
        .where(board)
        .orderBy(desc(gameScores.score), gameScores.at)
        .limit(1),
      db
        .select()
        .from(gameBans)
        .where(activeBan())
        .orderBy(desc(gameBans.createdAt)),
    ])
    return {
      settings: {
        saving: settings.saving,
        holdFlagged: settings.holdFlagged,
        inNav: settings.inNav,
        since: settings.since?.toISOString() ?? null,
      },
      today: day,
      saved: scores.saved,
      held: scores.held,
      best: best ?? null,
      bans: bans.map(
        (b): AdminBan => ({
          id: b.id,
          kind: b.kind,
          value: b.value,
          label: b.label,
          reason: b.reason,
          shadow: b.shadow,
          createdByName: b.createdByName,
          createdAt: b.createdAt.toISOString(),
          expiresAt: b.expiresAt?.toISOString() ?? null,
        })
      ),
    }
  })

/**
 * Saved runs, best first, with their place on the leaderboard: all of them
 * or one view, optionally only names containing `q` or runs from one
 * device. Admins only.
 */
export const getScores = createServerFn({ method: "GET" })
  .middleware([admin])
  .validator(
    z.object({
      q: z.string().trim().max(200).default(""),
      view: z.enum(SCORE_VIEWS).default("alla"),
      device: z.string().max(100).nullable().default(null),
      limit: z.number().int().min(1).max(1000).default(PAGE_SIZE),
    })
  )
  .handler(async ({ data }): Promise<AdminScores> => {
    const { since } = await readGameSettings()
    const board = onLeaderboard(since)
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
          status: gameScores.status,
          flags: gameScores.flags,
          device: gameScores.device,
          fingerprint: gameScores.fingerprint,
          ip: gameScores.ip,
          ticks: gameRuns.ticks,
          rank: sql<
            number | null
          >`case when ${board} then row_number() over (partition by (${board}) order by ${gameScores.score} desc, ${gameScores.at} asc, ${gameScores.id} asc) end`.as(
            "rank"
          ),
          sameName:
            sql<number>`count(*) over (partition by lower(${gameScores.name}))`.as(
              "same_name"
            ),
          sameDevice:
            sql<number>`case when ${gameScores.device} is null then 1 else count(*) over (partition by ${gameScores.device}) end`.as(
              "same_device"
            ),
        })
        .from(gameScores)
        .leftJoin(gameRuns, eq(gameRuns.id, gameScores.runId))
    )
    const views: Record<ScoreView, ReturnType<typeof sql> | undefined> = {
      alla: undefined,
      granska: sql`${ranked.status} = 'held'`,
      flaggade: holdFlagged(ranked.flags as never),
      dolda: sql`${ranked.status} in ('hidden', 'shadow')`,
    }
    const [rows, [counts]] = await Promise.all([
      db
        .with(ranked)
        .select({
          id: ranked.id,
          name: ranked.name,
          score: ranked.score,
          cans: ranked.cans,
          distance: ranked.distance,
          at: ranked.at,
          status: ranked.status,
          flags: ranked.flags,
          device: ranked.device,
          fingerprint: ranked.fingerprint,
          ip: ranked.ip,
          ticks: ranked.ticks,
          rank: ranked.rank,
          sameName: ranked.sameName,
          sameDevice: ranked.sameDevice,
          matching: sql<number>`count(*) over ()`.mapWith(Number),
        })
        .from(ranked)
        .where(
          and(
            data.q ? ilike(ranked.name, containsPattern(data.q)) : undefined,
            data.device ? eq(ranked.device, data.device) : undefined,
            views[data.view]
          )
        )
        .orderBy(desc(ranked.score), ranked.at, ranked.id)
        .limit(data.limit),
      db
        .select({
          alla: count(),
          granska:
            sql<number>`count(*) filter (where ${gameScores.status} = 'held')`.mapWith(
              Number
            ),
          flaggade:
            sql<number>`count(*) filter (where ${holdFlagged(gameScores.flags)})`.mapWith(
              Number
            ),
          dolda:
            sql<number>`count(*) filter (where ${gameScores.status} in ('hidden', 'shadow'))`.mapWith(
              Number
            ),
        })
        .from(gameScores),
    ])
    return {
      entries: rows.map(({ matching: _, ticks, ...r }) => {
        const at = new Date(r.at)
        return {
          ...r,
          rank: r.rank === null ? null : Number(r.rank),
          sameName: Number(r.sameName),
          sameDevice: Number(r.sameDevice),
          at: at.toISOString(),
          seconds: ticks === null ? null : Math.round(ticks / TICK_RATE),
          old: !!since && at < since,
        }
      }),
      matching: rows[0]?.matching ?? 0,
      views: counts,
    }
  })

/**
 * Removes one run, or every run under a name (ignoring case), and logs who
 * did it. Returns how many runs were removed. Admins only.
 */
export const removeScores = createServerFn({ method: "POST" })
  .middleware([admin])
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

const MODERATION = {
  approve: {
    from: ["held"],
    to: "visible",
    verb: "godkände",
  },
  hide: {
    from: ["visible", "held", "shadow"],
    to: "hidden",
    verb: "dolde",
  },
  show: {
    from: ["hidden", "shadow"],
    to: "visible",
    verb: "visade igen",
  },
} as const

/**
 * Approves a held run, hides a run, or shows a hidden one again, and logs
 * it. Returns whether anything changed. Admins only.
 */
export const moderateScore = createServerFn({ method: "POST" })
  .middleware([admin])
  .validator(
    z.object({
      id: z.number().int(),
      action: z.enum(["approve", "hide", "show"]),
    })
  )
  .handler(async ({ data, context }): Promise<{ changed: boolean }> => {
    const m = MODERATION[data.action]
    return db.transaction(async (tx) => {
      const [row] = await tx
        .update(gameScores)
        .set({ status: m.to })
        .where(
          and(
            eq(gameScores.id, data.id),
            inArray(gameScores.status, [...m.from])
          )
        )
        .returning()
      if (!row) return { changed: false }
      await log(
        tx,
        context.user,
        data.action,
        `${m.verb} ”${row.name}” (${points(row.score)}) i Puckopist`
      )
      return { changed: true }
    })
  })

/** Approves every run waiting for review, and logs it. Admins only. */
export const approveAllHeld = createServerFn({ method: "POST" })
  .middleware([admin])
  .handler(async ({ context }): Promise<{ approved: number }> => {
    return db.transaction(async (tx) => {
      const rows = await tx
        .update(gameScores)
        .set({ status: "visible" })
        .where(eq(gameScores.status, "held"))
        .returning({ id: gameScores.id })
      if (rows.length)
        await log(
          tx,
          context.user,
          "approve",
          `godkände ${rows.length} åk som väntade på granskning i Puckopist`
        )
      return { approved: rows.length }
    })
  })

const banTerms = {
  shadow: z.boolean(),
  /** Null: until lifted. */
  hours: z
    .number()
    .int()
    .min(1)
    .max(24 * 365)
    .nullable(),
  reason: z.string().trim().max(200).default(""),
}

/**
 * Bans whoever saved a run: their device, and optionally their browser
 * fingerprint and IP. Their saved runs are hidden. Admins only.
 */
export const banPlayer = createServerFn({ method: "POST" })
  .middleware([admin])
  .validator(
    z.object({
      scoreId: z.number().int(),
      fingerprint: z.boolean(),
      ip: z.boolean(),
      ...banTerms,
    })
  )
  .handler(
    async ({ data, context }): Promise<{ bans: number; hidden: number }> => {
      const [score] = await db
        .select()
        .from(gameScores)
        .where(eq(gameScores.id, data.scoreId))
      if (!score) fail(404, "Åket finns inte längre.")
      const values = [
        score.device && { kind: "device" as const, value: score.device },
        data.fingerprint &&
          score.fingerprint && {
            kind: "fingerprint" as const,
            value: score.fingerprint,
          },
        data.ip && score.ip && { kind: "ip" as const, value: score.ip },
      ].filter((v) => !!v)
      if (!values.length)
        fail(409, "Åket sparades före enhets-id:n. Banna namnet i stället.")
      return db.transaction(async (tx) => {
        await tx.insert(gameBans).values(
          values.map((v) => ({
            ...v,
            label: score.name,
            reason: data.reason || null,
            shadow: data.shadow,
            expiresAt: banEnds(data.hours),
            createdBy: context.user.kthid,
            createdByName: context.user.name,
          }))
        )
        const hidden = await tx
          .update(gameScores)
          .set({ status: "hidden" })
          .where(
            and(
              inArray(gameScores.status, ["visible", "held", "shadow"]),
              or(
                ...values.map((v) =>
                  eq(
                    v.kind === "device"
                      ? gameScores.device
                      : v.kind === "fingerprint"
                        ? gameScores.fingerprint
                        : gameScores.ip,
                    v.value
                  )
                )
              )
            )
          )
          .returning({ id: gameScores.id })
        const how = values.map((v) => BAN_LABELS[v.kind].label.toLowerCase())
        await log(
          tx,
          context.user,
          "ban",
          `${data.shadow ? "skuggbannade" : "bannade"} ”${score.name}” i Puckopist (${how.join(" + ")}, ${describeDuration(data.hours)})`
        )
        return { bans: values.length, hidden: hidden.length }
      })
    }
  )

const banValue = {
  device: z.uuid("Inte ett enhets-id."),
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/, "Inte ett fingeravtryck."),
  ip: z.union([z.ipv4(), z.ipv6()], "Inte en IP-adress."),
  name: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "Minst två tecken.")
    .max(40, "Högst 40 tecken."),
}

/** Adds a ban by hand, e.g. on a word in names. Admins only. */
export const addBan = createServerFn({ method: "POST" })
  .middleware([admin])
  .validator(
    z
      .object({ kind: z.enum(BAN_KINDS), value: z.string(), ...banTerms })
      .transform((d, ctx) => {
        const v = banValue[d.kind].safeParse(d.value)
        if (!v.success) {
          ctx.addIssue({ code: "custom", message: v.error.issues[0].message })
          return z.NEVER
        }
        return { ...d, value: v.data }
      })
  )
  .handler(async ({ data, context }) => {
    await db.transaction(async (tx) => {
      await tx.insert(gameBans).values({
        kind: data.kind,
        value: data.value,
        reason: data.reason || null,
        shadow: data.shadow,
        expiresAt: banEnds(data.hours),
        createdBy: context.user.kthid,
        createdByName: context.user.name,
      })
      const what =
        data.kind === "name"
          ? `namn med ”${data.value}”`
          : `${BAN_LABELS[data.kind].label.toLowerCase()} ${data.value.slice(0, 15)}`
      await log(
        tx,
        context.user,
        "ban",
        `${data.shadow ? "skuggbannade" : "bannade"} ${what} i Puckopist (${describeDuration(data.hours)})`
      )
    })
  })

/** Lifts a ban early. Admins only. */
export const liftBan = createServerFn({ method: "POST" })
  .middleware([admin])
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data, context }): Promise<{ lifted: boolean }> => {
    return db.transaction(async (tx) => {
      const [ban] = await tx
        .update(gameBans)
        .set({
          liftedAt: new Date(),
          liftedBy: context.user.kthid,
          liftedByName: context.user.name,
        })
        .where(and(eq(gameBans.id, data.id), isNull(gameBans.liftedAt)))
        .returning()
      if (!ban) return { lifted: false }
      const what =
        ban.kind === "name"
          ? `namn med ”${ban.value}”`
          : ban.label
            ? `”${ban.label}”`
            : BAN_LABELS[ban.kind].label.toLowerCase()
      await log(
        tx,
        context.user,
        "unban",
        `hävde bannet av ${what} i Puckopist`
      )
      return { lifted: true }
    })
  })

/** Changes saving, holding flagged runs, or the start page link. Admins only. */
export const setGameSettings = createServerFn({ method: "POST" })
  .middleware([admin])
  .validator(
    z.object({
      saving: z.boolean().optional(),
      holdFlagged: z.boolean().optional(),
      inNav: z.boolean().optional(),
    })
  )
  .handler(async ({ data, context }) => {
    await db.transaction(async (tx) => {
      await saveSettings(tx, context.user, {
        puckopistSaving: data.saving,
        puckopistHoldFlagged: data.holdFlagged,
        puckopistInNav: data.inNav,
      })
      if (data.saving !== undefined)
        await log(
          tx,
          context.user,
          "setting",
          data.saving
            ? "öppnade Puckopists topplista för nya åk"
            : "stängde Puckopists topplista för nya åk"
        )
      if (data.inNav !== undefined)
        await log(
          tx,
          context.user,
          "setting",
          data.inNav
            ? "visar Puckopist i menyn på startsidan"
            : "tog bort Puckopist från menyn på startsidan"
        )
      if (data.holdFlagged !== undefined)
        await log(
          tx,
          context.user,
          "setting",
          data.holdFlagged
            ? "slog på granskning av flaggade åk i Puckopist"
            : "stängde av granskning av flaggade åk i Puckopist"
        )
    })
  })

/**
 * Starts a fresh leaderboard: only runs from now on count. Nothing is
 * removed. Admins only.
 */
export const resetLeaderboard = createServerFn({ method: "POST" })
  .middleware([admin])
  .handler(async ({ context }) => {
    await db.transaction(async (tx) => {
      await saveSettings(tx, context.user, { puckopistSince: new Date() })
      await log(tx, context.user, "reset", "nollställde Puckopists topplista")
    })
  })
