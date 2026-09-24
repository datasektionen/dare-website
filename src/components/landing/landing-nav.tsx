import { cn } from "@/lib/utils"
import type { Lang } from "./countdown"

export function LandingNav({
  lang,
  onLang,
  className,
}: {
  lang: Lang
  onLang: (lang: Lang) => void
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
      <div className="flex gap-0.5 rounded-full border border-white/22 bg-white/12 p-[3px] backdrop-blur-[10px]">
        {(["sv", "en"] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => onLang(l)}
            aria-pressed={lang === l}
            className={cn(
              "cursor-pointer rounded-full border-0 px-[11px] py-1.5 font-['IBM_Plex_Mono',monospace] text-xs font-medium tracking-[.08em] uppercase transition-colors duration-200",
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
  )
}
