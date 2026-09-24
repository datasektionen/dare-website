import { useEffect, useRef, useState } from "react"

export type Lang = "sv" | "en"

const LABELS: Record<Lang, [string, string, string, string]> = {
  sv: ["dagar", "timmar", "minuter", "sekunder"],
  en: ["days", "hours", "minutes", "seconds"],
}

// Icy digits: a moving highlight over crosshatched frost and a blue gradient.
// The highlight sweep is the `dare-shimmer` keyframes in styles.css.
const DIGIT_BACKGROUND = [
  "linear-gradient(100deg,rgba(255,255,255,0) 40%,rgba(255,255,255,.95) 50%,rgba(255,255,255,0) 60%)",
  "repeating-linear-gradient(118deg,rgba(255,255,255,0) 0 7px,rgba(255,255,255,.3) 8px,rgba(255,255,255,0) 10px)",
  "repeating-linear-gradient(62deg,rgba(120,170,220,0) 0 13px,rgba(120,170,220,.24) 14px,rgba(120,170,220,0) 15px)",
  "linear-gradient(180deg,#ffffff 0%,#eef8ff 26%,#bfe0f8 50%,#f4fbff 57%,#7fb4e4 80%,#b9dcf6 100%)",
].join(",")

/** Days/hours/minutes/seconds until `target`. Calls `onZero` when it hits 0. */
export function Countdown({
  target,
  lang,
  onZero,
}: {
  target: Date
  lang: Lang
  onZero?: () => void
}) {
  // Whole seconds, so React only re-renders when the display changes.
  const [nowS, setNowS] = useState(() => Math.floor(Date.now() / 1000))
  const rootRef = useRef<HTMLDivElement>(null)
  const prev = useRef(new Map<string, string>())
  const firedFor = useRef<number | null>(null)

  const tgt = target.getTime()
  const ms = Math.max(0, tgt - nowS * 1000)
  const units = [
    Math.floor(ms / 864e5),
    Math.floor(ms / 36e5) % 24,
    Math.floor(ms / 6e4) % 60,
    Math.floor(ms / 1e3) % 60,
  ]

  useEffect(() => {
    const iv = setInterval(() => setNowS(Math.floor(Date.now() / 1000)), 250)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    if (ms === 0 && firedFor.current !== tgt) {
      firedFor.current = tgt
      onZero?.()
    }
  }, [ms, tgt, onZero])

  // Drop in digits that changed since the last render. Only transform and
  // opacity are animated, so it stays on the compositor.
  useEffect(() => {
    rootRef.current?.querySelectorAll<HTMLElement>("[data-dg]").forEach((e) => {
      const k = e.dataset.dg ?? ""
      const v = e.dataset.v ?? ""
      const old = prev.current.get(k)
      if (old !== undefined && old !== v)
        e.animate(
          [
            { transform: "translateY(-22%) scale(1.06)", opacity: 0.15 },
            { transform: "none", opacity: 1 },
          ],
          { duration: 650, easing: "cubic-bezier(.2,.8,.2,1)" }
        )
      prev.current.set(k, v)
    })
  })

  let digitIndex = 0
  return (
    <div
      ref={rootRef}
      className="flex items-start justify-center gap-[clamp(10px,2.6vw,48px)]"
    >
      {units.map((value, ui) => (
        <div
          key={LABELS.en[ui]}
          className="flex flex-col items-center gap-[clamp(6px,1.1vw,16px)]"
        >
          <div className="flex font-['Big_Shoulders_Display',sans-serif] text-[clamp(64px,14.5vw,270px)] leading-[.9] font-black">
            {String(value)
              .padStart(2, "0")
              .split("")
              .map((c, i) => {
                const n = digitIndex++
                return (
                  <span
                    // Digits are positional; the index is the identity.
                    // biome-ignore lint/suspicious/noArrayIndexKey: see above
                    key={i}
                    data-dg={`${ui}-${i}`}
                    data-v={c}
                    // The server's clock differs from the client's by a moment.
                    suppressHydrationWarning
                    className="relative inline-block w-[.54em] text-center"
                  >
                    {/* Glow and shadow on a separate, static layer, so the
                        animated highlight never repaints the filters. */}
                    <span
                      aria-hidden
                      suppressHydrationWarning
                      className={`absolute inset-0 text-[#cfe6f8] [filter:drop-shadow(0_0_24px_rgba(150,205,255,.45))_drop-shadow(0_3px_10px_rgba(8,20,60,.45))_drop-shadow(0_14px_40px_rgba(6,14,45,.55))]`}
                    >
                      {c}
                    </span>
                    <span
                      suppressHydrationWarning
                      className="relative block animate-[dare-shimmer_5.72s_linear_infinite] bg-clip-text text-transparent"
                      style={{
                        backgroundImage: DIGIT_BACKGROUND,
                        backgroundSize: "300% 100%,auto,auto,100% 100%",
                        animationDelay: `${-0.154 * n}s`,
                      }}
                    >
                      {c}
                    </span>
                  </span>
                )
              })}
          </div>
          <div className="font-['IBM_Plex_Mono',monospace] text-[clamp(10px,1vw,14px)] font-medium tracking-[.32em] text-white uppercase [text-shadow:0_1px_3px_rgba(5,12,40,.7),0_2px_14px_rgba(5,12,40,.6)]">
            {LABELS[lang][ui]}
          </div>
        </div>
      ))}
    </div>
  )
}
