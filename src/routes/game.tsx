import digitFont from "@fontsource/big-shoulders-display/files/big-shoulders-display-latin-900-normal.woff2?url"
import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { useCallback, useEffect, useRef, useState } from "react"
import { fingerprint, sign, watchRun } from "@/components/game/anticheat-client"
import { Leaderboard, SaveScore } from "@/components/game/leaderboard"
import {
  type Hud,
  PuckopistRenderer,
} from "@/components/game/puckopist-renderer"
import {
  DISPLAY,
  ICE,
  MONO,
  SHADOW,
  T,
  type Texts,
} from "@/components/game/texts"
import type { Lang } from "@/components/landing/countdown"
import { LandingNav } from "@/components/landing/landing-nav"
import { Snow } from "@/components/landing/snow"
import { PillArrow, pillClass } from "@/components/landing/ticket-button"
import { macMessage } from "@/lib/game/anticheat"
import {
  beginRun,
  finishRun,
  startRun,
  type Ticket,
} from "@/lib/game/functions"
import type { ScoreEntry } from "@/lib/game/leaderboard"
import { CAN_POINTS, type GameEvent, packInputs } from "@/lib/game/puckopist"
import { leaderboardQuery } from "@/lib/game/queries"
import { featuresQuery } from "@/lib/settings/queries"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/game")({
  staticData: { siteHeader: false, toasts: false },
  head: () => ({
    meta: [{ title: "Puckopist · dÅre 27" }],
    links: [
      {
        rel: "preload",
        href: digitFont,
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
    ],
  }),
  // Only exists while switched on in the dashboard settings.
  beforeLoad: async ({ context }) => {
    const features = await context.queryClient.ensureQueryData(featuresQuery)
    if (!features.puckopist) throw redirect({ to: "/" })
  },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(leaderboardQuery),
  component: GamePage,
})

type Phase = "ready" | "playing" | "over"
type Pop = { id: number; e: GameEvent; x: number; y: number; tilt: number }
type Result = Hud & { record: boolean }
/**
 * Whether the run can be saved: the server checks it right after the crash.
 * `offline` when there was no ticket (or no answer), `blocked` for banned
 * players, `closed` when saving is switched off.
 */
type Check =
  | { state: "checking" }
  | { state: "ok"; runId: string }
  | { state: "closed" | "rejected" | "offline" | "blocked" }

/** Tickets older than this are swapped for a fresh one before riding. */
const TICKET_FRESH = 15 * 60_000
/** How long starting waits for a ticket still on its way. */
const TICKET_WAIT = 2500

type Fetched = { ticket: Ticket | null; at: number }

const BEST_KEY = "puckopist-best"
/** How long the wipeout plays out before the score is shown. */
const OVER_DELAY = 1200
/** Ignore presses this soon after the score is shown, so a held jump doesn't restart. */
const RESTART_GUARD = 600

let nextId = 0

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0
  } catch {
    return 0
  }
}

function saveBest(score: number) {
  try {
    localStorage.setItem(BEST_KEY, String(score))
  } catch {
    // Private mode or blocked storage: the record just isn't kept.
  }
}

/** Typing in a field must not jump or restart. */
function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  )
}

function GamePage() {
  const { user } = Route.useRouteContext()
  const queryClient = useQueryClient()
  const [lang, setLang] = useState<Lang>("sv")
  const L = T[lang]
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<PuckopistRenderer | null>(null)
  const [phase, setPhase] = useState<Phase>("ready")
  const phaseRef = useRef<Phase>("ready")
  const shownAt = useRef(0)
  const [hud, setHud] = useState<Hud>({
    score: 0,
    cans: 0,
    distance: 0,
    combo: 0,
  })
  const [best, setBest] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  /** This run, once saved to the leaderboard. */
  const [mine, setMine] = useState<ScoreEntry | null>(null)
  const [showBoard, setShowBoard] = useState(false)
  const [pops, setPops] = useState<Pop[]>([])
  const [check, setCheck] = useState<Check>({ state: "offline" })
  /** The run was saved but waits for an admin before it shows. */
  const [held, setHeld] = useState(false)
  /** The next run's ticket, fetched in advance. */
  const nextTicket = useRef<Promise<Fetched> | null>(null)
  /** The ticket of the run being ridden. */
  const ticketRef = useRef<Ticket | null>(null)
  const watcher = useRef<ReturnType<typeof watchRun> | null>(null)
  const starting = useRef(false)

  const fetchTicket = useCallback(() => {
    const at = Date.now()
    nextTicket.current = fingerprint()
      .catch(() => null)
      .then((fp) => startRun({ data: { fingerprint: fp } }))
      .then((ticket) => ({ ticket, at }))
      .catch(() => ({ ticket: null, at }))
  }, [])
  // Phones and tablets get instructions for tapping instead of keys.
  const [touch, setTouch] = useState(false)

  const changePhase = useCallback((p: Phase) => {
    phaseRef.current = p
    shownAt.current = Date.now()
    setPhase(p)
  }, [])

  const start = useCallback(async () => {
    if (Date.now() - shownAt.current < RESTART_GUARD || starting.current) return
    starting.current = true
    if (!nextTicket.current) fetchTicket()
    let fetched = await Promise.race([
      nextTicket.current,
      new Promise<null>((r) => setTimeout(r, TICKET_WAIT, null)),
    ])
    if (fetched && Date.now() - fetched.at > TICKET_FRESH) {
      fetchTicket()
      fetched = await nextTicket.current
    }
    nextTicket.current = null
    starting.current = false
    const ticket = fetched?.ticket ?? null
    ticketRef.current = ticket
    // Without a ticket the run can't be saved, but it can still be ridden.
    const run = ticket && "runId" in ticket ? ticket : null
    if (run) beginRun({ data: { runId: run.runId } }).catch(() => {})
    watcher.current?.stop()
    watcher.current = watchRun()
    rendererRef.current?.play(run?.seed ?? Math.floor(Math.random() * 2 ** 31))
    setHud({ score: 0, cans: 0, distance: 0, combo: 0 })
    setPops([])
    setMine(null)
    setHeld(false)
    changePhase("playing")
  }, [changePhase, fetchTicket])

  /** Sends the run to the server to check, the moment it ends. */
  const submitRun = useCallback(() => {
    const renderer = rendererRef.current
    const ticket = ticketRef.current
    const flags = watcher.current?.flags() ?? []
    watcher.current?.stop()
    watcher.current = null
    fetchTicket()
    if (!renderer || !ticket || !("runId" in ticket)) {
      setCheck({ state: ticket ? "blocked" : "offline" })
      return
    }
    const r = renderer.result()
    const inputs = packInputs(r.inputs)
    const body = { ...r, runId: ticket.runId, inputs }
    setCheck({ state: "checking" })
    sign(ticket.key, macMessage(body))
      .catch(() => "")
      .then((mac) => finishRun({ data: { ...body, mac, flags } }))
      .then((v) =>
        setCheck(
          !v.ok
            ? { state: "rejected" }
            : ticket.saving
              ? { state: "ok", runId: ticket.runId }
              : { state: "closed" }
        )
      )
      .catch(() => setCheck({ state: "offline" }))
  }, [fetchTicket])

  const onEvent = useCallback(
    (e: GameEvent, at: { x: number; y: number }) => {
      if (e.kind === "jump") return
      if (e.kind === "land" && e.points === 0) return
      const id = ++nextId
      const pop = { id, e, ...at, tilt: Math.random() * 12 - 6 }
      setPops((p) => [...p.slice(-6), pop])
      setTimeout(() => setPops((p) => p.filter((q) => q.id !== id)), 1300)
      if (e.kind !== "crash") return

      submitRun()
      navigator.vibrate?.(80)
      setTimeout(() => {
        const stats = rendererRef.current?.stats()
        if (!stats) return
        const previous = readBest()
        const record = stats.score > previous
        if (record) saveBest(stats.score)
        setBest(Math.max(previous, stats.score))
        setResult({ ...stats, record })
        changePhase("over")
        // Others may have played since the page loaded.
        queryClient.invalidateQueries({ queryKey: leaderboardQuery.queryKey })
      }, OVER_DELAY)
    },
    [changePhase, queryClient, submitRun]
  )

  useEffect(() => {
    setBest(readBest())
    setTouch(matchMedia("(pointer: coarse)").matches)
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = new PuckopistRenderer(canvas, {
      onEvent,
      onHud: setHud,
      shake: !matchMedia("(prefers-reduced-motion: reduce)").matches,
    })
    rendererRef.current = renderer
    renderer.start()
    return () => renderer.destroy()
  }, [onEvent])

  // The first ticket, so the first run starts straight away.
  useEffect(() => {
    fetchTicket()
    return () => watcher.current?.stop()
  }, [fetchTicket])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  // Space, up or W jumps, and so does pressing anywhere on the piste with a
  // finger or the mouse. On the start and score screens, the keys start a run.
  useEffect(() => {
    const root = rootRef.current
    const isJump = (e: KeyboardEvent) =>
      e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW"
    const onDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      const enter = e.code === "Enter" || e.code === "NumpadEnter"
      if (!isJump(e) && !enter) return
      // Enter on a focused button already clicks it.
      if (enter && e.target instanceof HTMLButtonElement) return
      e.preventDefault()
      if (e.repeat) return
      if (phaseRef.current === "playing") rendererRef.current?.press()
      else start()
    }
    const onUp = (e: KeyboardEvent) => {
      if (isJump(e)) rendererRef.current?.release()
    }
    // Jump stays held while any finger is down, so a second finger landing
    // or lifting doesn't cut a flip short.
    const fingers = new Set<number>()
    const onPointer = (e: PointerEvent) => {
      if (phaseRef.current !== "playing") return
      // Let the logo and language buttons work.
      if ((e.target as HTMLElement).closest("a,button")) return
      e.preventDefault()
      fingers.add(e.pointerId)
      rendererRef.current?.press()
    }
    const onLift = (e: PointerEvent) => {
      fingers.delete(e.pointerId)
      if (fingers.size === 0) rendererRef.current?.release()
    }
    const releaseAll = () => {
      fingers.clear()
      rendererRef.current?.release()
    }
    // Long presses on phones would open a menu.
    const noMenu = (e: Event) => {
      if (!isTyping(e.target)) e.preventDefault()
    }
    root?.addEventListener("pointerdown", onPointer)
    root?.addEventListener("contextmenu", noMenu)
    addEventListener("keydown", onDown)
    addEventListener("keyup", onUp)
    addEventListener("pointerup", onLift)
    addEventListener("pointercancel", onLift)
    addEventListener("blur", releaseAll)
    return () => {
      root?.removeEventListener("pointerdown", onPointer)
      root?.removeEventListener("contextmenu", noMenu)
      removeEventListener("keydown", onDown)
      removeEventListener("keyup", onUp)
      removeEventListener("pointerup", onLift)
      removeEventListener("pointercancel", onLift)
      removeEventListener("blur", releaseAll)
    }
  }, [start])

  const admin = !!user?.isAdmin
  const defaultName = user?.name.split(" ")[0] ?? ""

  return (
    <div
      ref={rootRef}
      lang={lang}
      className={cn(
        "fixed inset-0 overflow-hidden bg-[#050818] font-['Instrument_Sans',sans-serif] text-white select-none selection:bg-[#e83d84] [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none]",
        // While riding, a finger on the screen is for jumping, never for
        // scrolling or zooming the page.
        phase === "playing" && "touch-none"
      )}
    >
      <canvas ref={canvasRef} className="absolute inset-0 block size-full" />
      <Snow
        density={0.5}
        className="pointer-events-none absolute inset-0 z-[1]"
      />
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,transparent_60%,rgba(3,6,20,.55))]" />
      <LandingNav
        lang={lang}
        onLang={setLang}
        className="absolute inset-x-0 top-0 z-30"
      />

      {phase === "playing" && <Scoreboard hud={hud} L={L} />}

      <div className="pointer-events-none absolute inset-0 z-20">
        {pops.map((p) => (
          <PopText key={p.id} pop={p} L={L} />
        ))}
      </div>

      {phase !== "playing" && (
        // Scrolls when it doesn't fit, e.g. on a phone held sideways.
        <div className="absolute inset-0 z-20 touch-manipulation overflow-y-auto overscroll-contain bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(5,8,24,.72)_0%,rgba(5,8,24,.35)_60%,rgba(5,8,24,0)_100%)]">
          <div className="flex min-h-full flex-col items-center justify-center gap-[clamp(18px,3vh,32px)] px-5 pt-[clamp(84px,12vh,120px)] pb-8 text-center [@media(max-height:500px)]:pt-[76px] [@media(max-height:500px)]:pb-4">
            {phase === "ready" ? (
              <>
                <div className="flex flex-col items-center gap-[clamp(10px,1.8vh,18px)]">
                  <h1
                    className={cn(
                      DISPLAY,
                      ICE,
                      "text-[clamp(56px,13.2vw,230px)] leading-[.85] uppercase [@media(max-height:500px)]:text-[64px]"
                    )}
                  >
                    Puckopist
                  </h1>
                  {!showBoard && (
                    <p
                      className={cn(
                        "max-w-[34ch] text-[clamp(16px,1.4vw,19px)] font-medium text-[#f4f8ff]",
                        SHADOW
                      )}
                    >
                      {L.tagline}
                    </p>
                  )}
                </div>
                {showBoard && <Leaderboard L={L} mine={null} admin={admin} />}
                <div className="flex flex-col items-center gap-4">
                  <StartButton label={L.start} onClick={start} />
                  {!showBoard && <Hint>{touch ? L.hintTouch : L.hint}</Hint>}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowBoard((s) => !s)}
                      className={cn(
                        MONO,
                        "cursor-pointer rounded-full border border-white/25 bg-white/10 px-4 py-2.5 text-[11px] tracking-[.2em] text-white backdrop-blur-[10px] transition-colors hover:bg-white/20"
                      )}
                    >
                      {showBoard ? L.back : L.leaderboard}
                    </button>
                    {best > 0 && <Hint>{`${L.best} ${best}`}</Hint>}
                  </div>
                </div>
              </>
            ) : (
              result && (
                <div className="flex w-full max-w-4xl flex-col items-center gap-[clamp(24px,4vh,40px)] md:flex-row md:items-center md:justify-center md:gap-14">
                  {/* Score and the way back on the piste first, so a phone
                      never has to scroll past the leaderboard to ride again. */}
                  <div className="flex w-full max-w-sm flex-col items-center gap-[clamp(10px,2.2vh,22px)]">
                    <div className="flex flex-col items-center gap-2">
                      {result.record && (
                        <div
                          className={cn(
                            MONO,
                            "mb-1 rounded-full bg-white px-4 py-1.5 text-xs font-medium tracking-[.2em] text-[#c92c6d] shadow-[0_8px_30px_rgba(232,61,132,.45)]"
                          )}
                        >
                          {L.newBest}
                        </div>
                      )}
                      <div
                        className={cn(
                          DISPLAY,
                          ICE,
                          "text-[clamp(80px,13vw,200px)] leading-[.85] tabular-nums [@media(max-height:500px)]:text-[60px]"
                        )}
                      >
                        {result.score}
                      </div>
                      <Label>{L.score}</Label>
                    </div>
                    {/* Left out when it would push "ride again" off a phone
                        held sideways. */}
                    <div className="flex gap-[clamp(28px,5vw,64px)] [@media(max-height:500px)]:hidden">
                      <Stat value={result.cans} label={L.cans} />
                      <Stat value={result.distance} label={L.metres} />
                    </div>
                    {mine || held ? (
                      <p
                        role="status"
                        className={cn(
                          "max-w-[34ch] text-[15px] font-medium",
                          SHADOW
                        )}
                      >
                        {mine ? L.saved(mine.rank) : L.held}
                      </p>
                    ) : (
                      result.score > 0 &&
                      (check.state === "ok" || check.state === "checking" ? (
                        <SaveScore
                          runId={check.state === "ok" ? check.runId : null}
                          run={result}
                          defaultName={defaultName}
                          onSaved={(entry) =>
                            entry.rank === null
                              ? setHeld(true)
                              : setMine({ ...entry, rank: entry.rank })
                          }
                          L={L}
                        />
                      ) : (
                        <p
                          role="status"
                          className={cn(
                            "max-w-[34ch] text-sm text-white/80",
                            SHADOW
                          )}
                        >
                          {L.cantSave[check.state]}
                        </p>
                      ))
                    )}
                    <div className="flex flex-col items-center gap-3 pt-1">
                      <StartButton label={L.again} onClick={start} />
                      {!result.record && best > 0 && (
                        <Hint>{`${L.best} ${best}`}</Hint>
                      )}
                    </div>
                  </div>
                  <Leaderboard L={L} mine={mine} admin={admin} />
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StartButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} className={pillClass}>
      <span>{label}</span>
      <PillArrow />
    </button>
  )
}

/** A quiet line of small print, like the controls. */
function Hint({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={cn(MONO, "text-[11px] tracking-[.2em] text-white/70", SHADOW)}
    >
      {children}
    </span>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        MONO,
        "text-[clamp(10px,1vw,13px)] font-medium tracking-[.32em] text-white [text-shadow:0_1px_3px_rgba(5,12,40,.7),0_2px_14px_rgba(5,12,40,.6)]"
      )}
    >
      {children}
    </div>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          DISPLAY,
          "text-[clamp(30px,4vw,56px)] leading-none text-white tabular-nums",
          SHADOW
        )}
      >
        {value}
      </div>
      <Label>{label}</Label>
    </div>
  )
}

/** Score, cans and distance, under the logo while riding. */
function Scoreboard({ hud, L }: { hud: Hud; L: Texts }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[clamp(78px,11vh,120px)] z-10 flex items-end justify-center gap-[clamp(24px,5vw,72px)]">
      <Stat value={hud.cans} label={L.cans} />
      <div className="flex flex-col items-center gap-1">
        <div
          className={cn(
            DISPLAY,
            ICE,
            "text-[clamp(52px,8vw,120px)] leading-[.85] tabular-nums"
          )}
        >
          {hud.score}
        </div>
        <Label>{L.score}</Label>
        {hud.combo > 1 && (
          // Keyed on the value, so every step up replays the bump.
          <span
            key={hud.combo}
            className={cn(
              DISPLAY,
              "mt-1 animate-[battle-bump_.5s_cubic-bezier(.2,.8,.2,1)] rounded-full bg-[#e83d84] px-3 py-0.5 text-[clamp(16px,1.8vw,24px)] leading-tight text-white italic shadow-[0_0_24px_rgba(232,61,132,.7)]"
            )}
          >
            {L.combo(hud.combo)}
          </span>
        )}
      </div>
      <Stat value={hud.distance} label={L.metres} />
    </div>
  )
}

/** Trick names, can points and the wipeout, popping up where they happen. */
function PopText({ pop, L }: { pop: Pop; L: Texts }) {
  const { e } = pop
  // Cans and plain jumps get a small number; tricks get the big words.
  const plain =
    e.kind === "land" && !e.flips && !e.bigAir && !e.perfect && e.combo < 2
  if (e.kind === "can" || plain)
    return (
      <span
        className={cn(
          DISPLAY,
          "absolute -translate-x-1/2 animate-[battle-float_1.1s_ease-out_forwards] text-[clamp(22px,2.6vw,38px)] text-[#ffc15a] italic [text-shadow:0_0_18px_rgba(255,150,40,.9)]"
        )}
        style={{ left: pop.x, top: pop.y - 30 }}
      >
        +{e.kind === "can" ? CAN_POINTS : e.points}
      </span>
    )

  const lines =
    e.kind === "crash"
      ? [L.crash]
      : e.kind === "land"
        ? [
            e.flips > 0 && (L.flips[e.flips] ?? L.manyFlips(e.flips)),
            e.hugeAir ? L.hugeAir : e.bigAir && L.bigAir,
            e.perfect && L.perfect,
            e.combo > 1 && L.combo(e.combo),
            `+${e.points}`,
          ].filter((l): l is string => !!l)
        : []
  return (
    <span
      className={cn(
        DISPLAY,
        "absolute flex animate-[battle-word_1.2s_cubic-bezier(.2,.8,.2,1)_forwards] flex-col items-center leading-[.95] whitespace-nowrap uppercase italic",
        e.kind === "crash"
          ? "text-[clamp(48px,8vw,140px)] text-white [-webkit-text-stroke:2px_#7a1745] [text-shadow:0_0_30px_rgba(232,61,132,.9),5px_5px_0_#7a1745]"
          : "text-[clamp(30px,4.4vw,76px)] text-[#ffe3ef] [-webkit-text-stroke:2px_#7a1745] [text-shadow:0_0_24px_rgba(232,61,132,.85),4px_4px_0_#7a1745]"
      )}
      style={{
        left: pop.x,
        top: pop.y,
        ["--tilt" as string]: `${pop.tilt}deg`,
      }}
    >
      {lines.map((l, i) => (
        <span
          key={l}
          className={
            i === lines.length - 1 && e.kind === "land"
              ? "text-[.6em] text-[#ffc15a]"
              : undefined
          }
        >
          {l}
        </span>
      ))}
    </span>
  )
}
