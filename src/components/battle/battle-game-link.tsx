import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { gameLinkQuery } from "@/lib/game/queries"
import { cn } from "@/lib/utils"

const DISPLAY = "font-['Big_Shoulders_Display',sans-serif] font-black"

/**
 * A plug for Puckopist on the battle screen, while the game is linked from
 * the start page. Spelled out for the TV, tappable on phones.
 */
export function BattleGameLink({ className }: { className?: string }) {
  const { data: show } = useQuery(gameLinkQuery)
  if (!show) return null
  return (
    <Link
      to="/game"
      className={cn(
        "pointer-events-auto flex -skew-x-6 flex-col gap-[.6vh] bg-black/55 px-[1.6vh] py-[1.2vh] text-white no-underline ring-2 ring-white/20 backdrop-blur-[2px]",
        className
      )}
    >
      <span
        className={cn(
          DISPLAY,
          "text-[clamp(18px,min(4.4vh,6vw),64px)] leading-none tracking-wide uppercase italic [text-shadow:0_0_16px_rgba(255,255,255,.6)]"
        )}
      >
        Spela Puckopist!
      </span>
      <span className="font-['IBM_Plex_Mono',monospace] text-[clamp(12px,min(2.4vh,3.4vw),34px)] leading-none font-medium text-white/80">
        dåre.datasektionen.se/game
      </span>
    </Link>
  )
}
