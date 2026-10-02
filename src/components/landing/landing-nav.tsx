import { PersonSimpleSkiIcon } from "@phosphor-icons/react"
import { Link } from "@tanstack/react-router"
import { cn } from "@/lib/utils"
import type { Lang } from "./countdown"

const PILL =
  "rounded-full border border-white/22 bg-white/12 backdrop-blur-[10px]"

export function LandingNav({
  lang,
  onLang,
  game = false,
  className,
}: {
  lang: Lang
  onLang: (lang: Lang) => void
  /** A link to Puckopist, when switched on in the dashboard. */
  game?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-5 px-[clamp(18px,3vw,44px)] py-[clamp(14px,2vw,26px)] text-white",
        className
      )}
    >
      <a href="/" className="flex items-center no-underline">
        <img
          src="/dare27-logo-white.png"
          alt="dÅre 2027"
          width={800}
          height={413}
          decoding="async"
          className="block h-[clamp(44px,5vw,64px)] w-auto drop-shadow-[0_2px_10px_rgba(5,10,35,.45)]"
        />
      </a>
      <div className="flex items-center gap-2">
        {game && (
          <Link
            to="/game"
            className={cn(
              PILL,
              "flex items-center gap-1.5 px-3.5 py-[7px] pointer-coarse:py-[11px] font-['IBM_Plex_Mono',monospace] text-xs font-medium tracking-[.08em] text-white uppercase no-underline transition-colors duration-200 hover:bg-white/22"
            )}
          >
            <PersonSimpleSkiIcon weight="bold" className="size-4" />
            Puckopist
          </Link>
        )}
        <div className={cn(PILL, "flex gap-0.5 p-[3px]")}>
          {(["sv", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => onLang(l)}
              aria-pressed={lang === l}
              className={cn(
                "cursor-pointer rounded-full border-0 px-[11px] py-1.5 pointer-coarse:px-3.5 pointer-coarse:py-2.5 font-['IBM_Plex_Mono',monospace] text-xs font-medium tracking-[.08em] uppercase transition-colors duration-200",
                lang === l
                  ? "bg-white text-[#0b1233]"
                  : "bg-transparent text-white/80"
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
