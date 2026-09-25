import {
  type BattleState,
  jaegerShare,
  leader,
  percentages,
  SIDE_NAMES,
  type Side,
} from "@/lib/battle/types"
import { cn } from "@/lib/utils"

const DISPLAY = "font-['Big_Shoulders_Display',sans-serif] font-black"

const THEME: Record<Side, { text: string; glow: string; bar: string }> = {
  jaeger: {
    text: "text-[#ffb347]",
    glow: "[text-shadow:0_0_24px_rgba(255,110,30,.8),0_0_60px_rgba(255,60,20,.5)]",
    bar: "bg-[linear-gradient(90deg,#7a1405,#ff3d2e_40%,#ff7a1a_80%,#ffd27a)]",
  },
  minttu: {
    text: "text-[#9eeaff]",
    glow: "[text-shadow:0_0_24px_rgba(60,200,255,.8),0_0_60px_rgba(40,120,255,.5)]",
    bar: "bg-[linear-gradient(90deg,#e8fbff,#3dd6ff_20%,#2a7bff_60%,#0b1f6b)]",
  },
}

/** One fighter's name, score and share, fighting-game style. */
function Corner({
  side,
  count,
  percent,
  koWarning,
}: {
  side: Side
  count: number
  percent: number
  koWarning: boolean
}) {
  const right = side === "minttu"
  const t = THEME[side]
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-[.4vh]",
        right ? "items-end text-right" : "items-start"
      )}
    >
      <div
        className={cn(
          // Stacked on narrow screens, side by side from `sm`.
          "flex flex-col sm:flex-row sm:items-baseline sm:gap-[1.2vw]",
          right ? "items-end sm:flex-row-reverse" : "items-start"
        )}
      >
        {/* Keyed on the value, so every change replays the bump. */}
        <span
          key={count}
          className={cn(
            DISPLAY,
            t.text,
            t.glow,
            "inline-block animate-[battle-bump_.5s_cubic-bezier(.2,.8,.2,1)] text-[clamp(48px,9vw,200px)] leading-[.85] tabular-nums italic"
          )}
        >
          {count}
        </span>
        <span
          className={cn(
            DISPLAY,
            "text-[clamp(16px,2.6vw,56px)] text-white/90 tabular-nums italic"
          )}
        >
          {percent.toFixed(1)}%
        </span>
      </div>
      <div
        className={cn(
          DISPLAY,
          "text-[clamp(16px,2.2vw,48px)] tracking-wide text-white uppercase italic"
        )}
      >
        {SIDE_NAMES[side]}
      </div>
      {koWarning && (
        <div
          className={cn(
            DISPLAY,
            "animate-[battle-blink_.6s_steps(2)_infinite] bg-red-600 px-[.8vw] py-[.2vh] text-[clamp(14px,1.6vw,32px)] tracking-wider text-white uppercase italic"
          )}
        >
          K.O.-varning!
        </div>
      )}
    </div>
  )
}

/** Score, tug-of-war bar and status line, drawn over the fighters. */
export function BattleHud({
  state,
  combo,
}: {
  state: BattleState
  combo: { side: Side; count: number } | null
}) {
  const share = jaegerShare(state)
  const [pj, pm] = percentages(state)
  const lead = leader(state)
  const total = state.jaeger + state.minttu
  const margin = Math.abs(state.jaeger - state.minttu)
  const ko = total >= 10 && (share >= 0.8 || share <= 0.2)

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between px-[4vw] pt-[3vh] pb-[4vh] text-white select-none">
      <div className="flex flex-col gap-[2vh]">
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-[2vw]">
          <Corner
            side="jaeger"
            count={state.jaeger}
            percent={pj}
            koWarning={ko && lead === "minttu"}
          />
          <div className="relative mt-[1vh] flex flex-col items-center">
            <div
              className={cn(
                DISPLAY,
                "text-[clamp(28px,6vw,130px)] leading-none text-white italic [text-shadow:0_0_20px_rgba(255,255,255,.9),0_0_60px_rgba(255,120,200,.6),0_6px_0_rgba(0,0,0,.5)]"
              )}
            >
              VS
            </div>
          </div>
          <Corner
            side="minttu"
            count={state.minttu}
            percent={pm}
            koWarning={ko && lead === "jaeger"}
          />
        </div>

        {/* Tug-of-war bar. The trailing white "chip" catches up after a delay. */}
        <div className="relative h-[clamp(14px,2.4vh,34px)] -skew-x-12 border-2 border-white/80 bg-black/60 shadow-[0_0_30px_rgba(0,0,0,.6)]">
          <div
            className="absolute inset-y-0 left-0 bg-white/80 transition-[width] delay-300 duration-700 ease-out"
            style={{ width: `${share * 100}%` }}
          />
          <div
            className={cn(
              "absolute inset-y-0 left-0 transition-[width] duration-300 ease-out",
              THEME.jaeger.bar
            )}
            style={{ width: `${share * 100}%` }}
          />
          <div
            className={cn(
              "absolute inset-y-0 right-0 transition-[width] duration-300 ease-out",
              THEME.minttu.bar
            )}
            style={{ width: `${(1 - share) * 100}%` }}
          />
          <div
            className="absolute -inset-y-[40%] w-[6px] -translate-x-1/2 bg-white shadow-[0_0_16px_6px_rgba(255,255,255,.9)] transition-[left] duration-300 ease-out"
            style={{ left: `${share * 100}%` }}
          />
          <div className="absolute inset-y-0 left-1/2 w-px bg-white/40" />
        </div>
      </div>

      <div className="flex flex-col items-center gap-[1vh]">
        {combo && combo.count >= 3 && (
          <div
            key={`${combo.side}-${combo.count}`}
            className={cn(
              DISPLAY,
              THEME[combo.side].text,
              THEME[combo.side].glow,
              "animate-[battle-bump_.45s_ease-out] text-[clamp(22px,3vw,64px)] uppercase italic"
            )}
          >
            {SIDE_NAMES[combo.side]} combo ×{combo.count}
          </div>
        )}
        <div
          className={cn(
            DISPLAY,
            "-skew-x-6 bg-black/55 px-[2vw] py-[.6vh] text-[clamp(24px,3.6vw,76px)] leading-none uppercase italic ring-2 ring-white/20 backdrop-blur-[2px]",
            lead ? [THEME[lead].text, THEME[lead].glow] : "text-white"
          )}
        >
          {total === 0
            ? "Första slaget avgör?"
            : lead
              ? `${SIDE_NAMES[lead]} leder med ${margin}`
              : "Dödläge!"}
        </div>
      </div>
    </div>
  )
}
