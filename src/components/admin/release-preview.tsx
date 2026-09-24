import { useNow } from "@/hooks/use-now"
import { formatRelease, splitDuration } from "@/lib/time"

const LABELS = ["dagar", "timmar", "minuter", "sekunder"]

/** A miniature of the landing page hero, counting down to `at`. */
export function ReleasePreview({ at }: { at: Date }) {
  const now = useNow()
  const released = now !== null && now >= at.getTime()
  const d = splitDuration(now === null ? 0 : at.getTime() - now)
  const units = [d.days, d.hours, d.minutes, d.seconds]

  return (
    <div className="relative overflow-hidden bg-[#050818] px-4 py-7 text-center text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(80,110,200,.35),transparent_70%),linear-gradient(180deg,#0a1233_0%,#050818_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(180deg,transparent,rgba(60,255,170,.07))]" />
      <div className="relative flex flex-col items-center gap-3">
        <div className="flex items-center gap-2 font-['IBM_Plex_Mono',monospace] text-[10px] tracking-[.3em] text-[#eef5ff] uppercase">
          <span className="h-px w-5 bg-white/60" />
          {released ? "Biljetterna är släppta" : "Biljettsläppet om"}
          <span className="h-px w-5 bg-white/60" />
        </div>
        <div className="flex items-start justify-center gap-3 sm:gap-5">
          {units.map((v, i) => (
            <div key={LABELS[i]} className="flex flex-col items-center gap-1">
              <span className="bg-[linear-gradient(180deg,#ffffff_0%,#eef8ff_26%,#bfe0f8_50%,#f4fbff_57%,#7fb4e4_80%,#b9dcf6_100%)] bg-clip-text font-['Big_Shoulders_Display',sans-serif] text-4xl leading-none font-black text-transparent tabular-nums drop-shadow-[0_0_12px_rgba(150,205,255,.35)] sm:text-5xl">
                {now === null ? "--" : String(v).padStart(2, "0")}
              </span>
              <span className="font-['IBM_Plex_Mono',monospace] text-[9px] tracking-[.25em] text-white/80 uppercase">
                {LABELS[i]}
              </span>
            </div>
          ))}
        </div>
        <div className="font-['Instrument_Sans',sans-serif] text-sm font-medium text-[#f4f8ff]">
          {formatRelease(at, "sv")}
        </div>
        <div className="font-['Instrument_Sans',sans-serif] text-xs text-white/55">
          {formatRelease(at, "en")}
        </div>
      </div>
    </div>
  )
}
