import { useRouter } from "@tanstack/react-router"
import { useEffect } from "react"
import { useBattleOnline } from "@/lib/battle/use-battle-stream"
import { cn } from "@/lib/utils"

/**
 * A small note in the corner of the big screens while the live connection
 * is down, so whoever runs the screen knows it isn't frozen for good.
 */
export function OfflineBadge({ className }: { className?: string }) {
  const online = useBattleOnline()
  if (online) return null
  return (
    <div
      role="status"
      className={cn(
        "pointer-events-none fixed z-50 flex items-center gap-[.8vh] bg-black/60 px-[1.4vh] py-[.7vh] font-['Instrument_Sans',sans-serif] text-[max(12px,1.6vh)] font-semibold text-white/80",
        className
      )}
    >
      <span className="size-[max(8px,1vh)] animate-pulse rounded-full bg-amber-400" />
      Återansluter…
    </div>
  )
}

/**
 * Error screen for the big screens: the page couldn't load (the server or
 * database was down), so keep trying instead of showing an error forever.
 */
export function RetryScreen() {
  const router = useRouter()
  useEffect(() => {
    // Reloads the route and resets the error boundary once it works.
    const t = setInterval(() => router.invalidate(), 5000)
    return () => clearInterval(t)
  }, [router])
  return (
    <div className="fixed inset-0 grid cursor-none place-items-center bg-[#07040f] font-['Instrument_Sans',sans-serif] text-[max(14px,2.4vh)] font-semibold text-white/60">
      <p className="flex items-center gap-[1vh]">
        <span className="size-[max(8px,1.2vh)] animate-pulse rounded-full bg-amber-400" />
        Återansluter…
      </p>
    </div>
  )
}
