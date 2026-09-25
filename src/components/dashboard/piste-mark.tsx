import { cn } from "@/lib/utils"

/**
 * Piste difficulty markers from Scandinavian trail maps: green circle, blue
 * square, red diamond and black double diamond. Used as the dashboard's
 * little signposts instead of generic icons.
 */
export type Piste = "green" | "blue" | "red" | "black"

const COLOR: Record<Piste, string> = {
  green: "bg-(--piste-green)",
  blue: "bg-(--piste-blue)",
  red: "bg-(--piste-red)",
  black: "bg-(--piste-black) ring-1 ring-white/70",
}

export function PisteMark({
  piste,
  inverted,
  className,
}: {
  piste: Piste
  /** White, for use on a sign painted in the piste's colour. */
  inverted?: boolean
  className?: string
}) {
  const shape = inverted ? "bg-white" : COLOR[piste]
  if (piste === "black")
    return (
      <span
        aria-hidden
        className={cn("inline-flex shrink-0 items-center gap-px", className)}
      >
        <span className={cn("size-[7px] rotate-45", shape)} />
        <span className={cn("size-[7px] rotate-45", shape)} />
      </span>
    )
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2.5 shrink-0",
        piste === "green" && "rounded-full",
        piste === "red" && "size-2 rotate-45",
        shape,
        className
      )}
    />
  )
}
