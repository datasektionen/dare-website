import { useQuery } from "@tanstack/react-query"
import { QrCode } from "@/components/qr-code"
import { ticketLinkQuery } from "@/lib/ticket-release/queries"
import { cn } from "@/lib/utils"

const DISPLAY = "font-['Big_Shoulders_Display',sans-serif] font-black"

/**
 * The ticket link as a QR code on the battle screen, once tickets are out.
 * Tappable too; in portrait (a phone) it's just the button.
 */
export function BattleTicketQr({ className }: { className?: string }) {
  const { data: link } = useQuery(ticketLinkQuery)
  if (link?.state !== "open") return null
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "pointer-events-auto flex animate-[battle-bump_.6s_cubic-bezier(.2,.8,.2,1)] flex-col items-center",
        className
      )}
    >
      {/* Square and upright, so it scans; only the label below is slanted. */}
      <QrCode
        value={link.url}
        title="QR-kod till biljettköpet"
        className="hidden aspect-square w-[clamp(150px,34vh,460px)] rounded-[clamp(8px,1.4vh,18px)] shadow-[0_0_30px_rgba(0,0,0,.6)] ring-2 ring-white/60 landscape:sm:block"
      />
      <span
        className={cn(
          DISPLAY,
          "relative -skew-x-6 bg-black/70 px-[1.6vh] py-[.8vh] text-[clamp(16px,min(3.2vh,5vw),46px)] leading-none tracking-wide whitespace-nowrap text-white uppercase italic ring-2 ring-white/20 backdrop-blur-[2px] [text-shadow:0_0_16px_rgba(255,255,255,.6)] landscape:sm:-mt-[1.6vh]"
        )}
      >
        Köp biljett!
      </span>
    </a>
  )
}
