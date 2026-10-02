import { QrCode } from "@/components/qr-code"
import { cn } from "@/lib/utils"

/** As big as fits, leaving room for a logo above and a line below. */
export const BIG_QR = "w-[min(74svh,92vw)] rounded-[clamp(20px,3vh,40px)]"

/** The ticket link as a big QR code on a white card. */
export function TicketQr({
  url,
  caption,
  showCaption = false,
  className,
}: {
  url: string
  /** Read out by screen readers; shown under the code if `showCaption`. */
  caption: string
  showCaption?: boolean
  className?: string
}) {
  return (
    <figure
      className={cn(
        "flex flex-col items-center gap-3 rounded-[28px] bg-white p-[clamp(12px,1.6vw,22px)] shadow-[0_24px_80px_rgba(5,10,35,.55)]",
        className
      )}
    >
      <QrCode value={url} title={caption} className="aspect-square w-full" />
      {showCaption && (
        <figcaption className="pb-1 font-['Instrument_Sans',sans-serif] text-[clamp(14px,1.5vw,20px)] font-semibold text-[#0b1233]">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}
