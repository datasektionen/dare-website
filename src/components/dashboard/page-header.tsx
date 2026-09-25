import type { ReactNode } from "react"

/** Title row at the top of each dashboard page, set like a trail sign. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-2">
      <div className="flex min-w-0 flex-col gap-2">
        <h1 className="trail-sign text-4xl text-foreground sm:text-5xl">
          {title}
        </h1>
        {description && (
          <p className="max-w-prose text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
