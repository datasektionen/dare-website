import digitFont from "@fontsource/big-shoulders-display/files/big-shoulders-display-latin-900-normal.woff2?url"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { useCallback, useEffect, useRef, useState } from "react"
import { BattleHud } from "@/components/battle/battle-hud"
import { BattleRenderer } from "@/components/battle/battle-renderer"
import { battleQuery } from "@/lib/battle/queries"
import {
  type BattleUpdate,
  jaegerShare,
  leader,
  type Side,
} from "@/lib/battle/types"
import { useBattleStream } from "@/lib/battle/use-battle-stream"
import { featuresQuery } from "@/lib/settings/queries"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/battle")({
  staticData: { siteHeader: false, toasts: false },
  head: () => ({
    meta: [{ title: "Jäger vs Minttu · dÅre 27" }],
    links: [
      { rel: "preload", href: "/battle/arena.webp", as: "image" },
      { rel: "preload", href: "/battle/fighters.webp", as: "image" },
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
    if (!features.battle) throw redirect({ to: "/" })
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(battleQuery),
  component: BattlePage,
})

const WORDS = [
  "POW!",
  "BAM!",
  "KRASCH!",
  "SMACK!",
  "BOOM!",
  "PANG!",
  "WHAM!",
  "K-POW!",
]
/** Hits on the same side within this window build a combo. */
const COMBO_MS = 6000

type Word = {
  id: number
  text: string
  side: Side
  x: number
  y: number
  tilt: number
  big: boolean
}
type Float = { id: number; side: Side; text: string }
type Banner = { id: number; text: string }

let nextId = 0

function BattlePage() {
  // Read-only: scoring happens on the dashboard.
  const { data } = useSuspenseQuery({ ...battleQuery, refetchInterval: 15_000 })

  const stageRef = useRef<HTMLDivElement>(null)
  const fightersRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<BattleRenderer | null>(null)
  const comboRef = useRef<{ side: Side; count: number; at: number } | null>(
    null
  )

  const [words, setWords] = useState<Word[]>([])
  const [floats, setFloats] = useState<Float[]>([])
  const [banner, setBanner] = useState<Banner | null>(null)
  const [combo, setCombo] = useState<{ side: Side; count: number } | null>(null)
  const [idle, setIdle] = useState(false)

  const share = jaegerShare(data)
  const previousLeader = useRef(leader(data))
  const initialShare = useRef(share)

  useEffect(() => {
    const canvas = canvasRef.current
    const fighters = fightersRef.current
    const stage = stageRef.current
    if (!canvas || !fighters || !stage) return
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches
    const renderer = new BattleRenderer(canvas, fighters, stage, !reduced)
    rendererRef.current = renderer
    // Later changes are pushed in by the effect below.
    renderer.start(initialShare.current)
    return () => renderer.destroy()
  }, [])

  useEffect(() => {
    rendererRef.current?.setShare(share)
  }, [share])

  const showBanner = useCallback((text: string) => {
    const id = ++nextId
    setBanner({ id, text })
    setTimeout(() => setBanner((b) => (b?.id === id ? null : b)), 2200)
  }, [])

  const onUpdate = useCallback(
    (update: BattleUpdate) => {
      const renderer = rendererRef.current
      if (!update.event || !renderer) return
      const { kind, side } = update.event
      const nowLeader = leader(update)

      if (kind === "reset") {
        renderer.reset()
        comboRef.current = null
        setCombo(null)
        showBanner("Ny rond!")
        previousLeader.current = null
        return
      }
      if (kind !== "hit" || !side) {
        previousLeader.current = nowLeader
        return
      }

      // Taking the lead is a big hit.
      const tookLead = nowLeader === side && previousLeader.current !== side
      previousLeader.current = nowLeader
      renderer.hit(side, tookLead)

      const now = Date.now()
      const c = comboRef.current
      const count =
        c && c.side === side && now - c.at < COMBO_MS ? c.count + 1 : 1
      comboRef.current = { side, count, at: now }
      setCombo({ side, count })

      const { x, y } = renderer.clash()
      const id = ++nextId
      setWords((w) => [
        ...w.slice(-5),
        {
          id,
          side,
          x,
          y: y - innerHeight * 0.08,
          text: WORDS[Math.floor(Math.random() * WORDS.length)],
          tilt: Math.random() * 24 - 12,
          big: tookLead,
        },
      ])
      setFloats((f) => [...f.slice(-7), { id, side, text: "+1" }])
      setTimeout(() => {
        setWords((w) => w.filter((word) => word.id !== id))
        setFloats((f) => f.filter((fl) => fl.id !== id))
      }, 1300)
      if (tookLead && update.jaeger + update.minttu > 1)
        showBanner(`${side === "jaeger" ? "Jäger" : "Minttu"} tar ledningen!`)
    },
    [showBanner]
  )

  useBattleStream(onUpdate)

  // Combo fades out when the window passes.
  useEffect(() => {
    if (!combo) return
    const t = setTimeout(() => setCombo(null), COMBO_MS)
    return () => clearTimeout(t)
  }, [combo])

  // F toggles fullscreen (there's no on-screen button: it's for a TV).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key.toLowerCase() === "f") toggleFullscreen()
    }
    addEventListener("keydown", onKey)
    return () => removeEventListener("keydown", onKey)
  }, [])

  // Hide the cursor when the mouse is still.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const wake = () => {
      setIdle(false)
      clearTimeout(t)
      t = setTimeout(() => setIdle(true), 2500)
    }
    wake()
    addEventListener("pointermove", wake)
    return () => {
      clearTimeout(t)
      removeEventListener("pointermove", wake)
    }
  }, [])

  return (
    <div
      className={cn(
        "fixed inset-0 overflow-hidden bg-[#07040f] font-['Instrument_Sans',sans-serif]",
        idle && "cursor-none"
      )}
    >
      <div
        ref={stageRef}
        className="absolute -inset-[2%] will-change-transform"
      >
        {/* Arena, with a slow drift so the lights feel alive. */}
        <img
          src="/battle/arena.webp"
          alt=""
          className="absolute inset-0 size-full animate-[battle-kenburns_24s_ease-in-out_infinite_alternate] object-cover"
        />
        {/* Each side's light grows with its share. */}
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_0%_50%,rgba(255,60,30,.55),transparent_70%)] mix-blend-screen transition-opacity duration-700"
          style={{ opacity: 0.15 + share * 0.85 }}
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_100%_50%,rgba(40,170,255,.55),transparent_70%)] mix-blend-screen transition-opacity duration-700"
          style={{ opacity: 0.15 + (1 - share) * 0.85 }}
        />
        <div
          ref={fightersRef}
          className="absolute top-1/2 left-1/2 aspect-video w-[max(100vw,min(177.78vh,130vw))] will-change-transform"
        >
          <img
            src="/battle/fighters.webp"
            alt="Jägermeister och Minttu i boxningsringen"
            className="size-full drop-shadow-[0_30px_40px_rgba(0,0,0,.6)]"
            draggable={false}
          />
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-10 size-full"
      />
      {/* Vignette. */}
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,.65))]" />

      <BattleHud state={data} combo={combo} />

      {/* Impact words at the clash point. */}
      <div className="pointer-events-none absolute inset-0 z-30">
        {words.map((w) => (
          <span
            key={w.id}
            className={cn(
              "absolute animate-[battle-word_1.2s_cubic-bezier(.2,.8,.2,1)_forwards] font-['Big_Shoulders_Display',sans-serif] leading-none font-black whitespace-nowrap italic",
              w.big
                ? "text-[clamp(60px,11vw,260px)]"
                : "text-[clamp(40px,7vw,160px)]",
              w.side === "jaeger"
                ? "text-[#ffd27a] [-webkit-text-stroke:3px_#7a1405] [text-shadow:0_0_30px_rgba(255,110,30,.9),6px_6px_0_#7a1405]"
                : "text-white [-webkit-text-stroke:3px_#0b3a8a] [text-shadow:0_0_30px_rgba(60,200,255,.9),6px_6px_0_#0b3a8a]"
            )}
            style={{
              left: w.x,
              top: w.y,
              ["--tilt" as string]: `${w.tilt}deg`,
            }}
          >
            {w.text}
          </span>
        ))}
        {floats.map((f) => (
          <span
            key={f.id}
            className={cn(
              "absolute top-[30vh] animate-[battle-float_1.2s_ease-out_forwards] font-['Big_Shoulders_Display',sans-serif] text-[clamp(32px,5vw,110px)] font-black italic",
              f.side === "jaeger"
                ? "left-[6vw] text-[#ffb347] [text-shadow:0_0_24px_rgba(255,110,30,.9)]"
                : "right-[6vw] text-[#9eeaff] [text-shadow:0_0_24px_rgba(60,200,255,.9)]"
            )}
          >
            {f.text}
          </span>
        ))}
        {banner && (
          <div
            key={banner.id}
            className="absolute top-[64%] left-1/2 animate-[battle-banner_2.2s_cubic-bezier(.2,.8,.2,1)_forwards] bg-[linear-gradient(90deg,transparent,rgba(0,0,0,.75)_15%,rgba(0,0,0,.75)_85%,transparent)] px-[10vw] py-[1.5vh] font-['Big_Shoulders_Display',sans-serif] text-[clamp(40px,7vw,150px)] leading-none font-black whitespace-nowrap text-white uppercase [text-shadow:0_0_40px_rgba(255,255,255,.8)]"
          >
            {banner.text}
          </div>
        )}
      </div>
    </div>
  )
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen()
  else document.documentElement.requestFullscreen().catch(() => {})
}
