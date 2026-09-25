import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * A section heading like a trail sign: condensed uppercase text followed by
 * a hairline running to the edge, with optional actions on the right.
 */
export function SectionHeading({
  children,
  actions,
  className,
}: {
  children: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <h2 className="trail-sign shrink-0 text-lg text-foreground">
        {children}
      </h2>
      <span aria-hidden className="h-px flex-1 bg-border" />
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  )
}
