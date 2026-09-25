import { cn } from "@/lib/utils"

/** One snowy spruce, drawn in a 40×100 box with its base at the bottom. */
function Spruce({
  x,
  scale,
  shade,
}: {
  x: number
  scale: number
  shade: string
}) {
  return (
    <g transform={`translate(${x} ${100 - 100 * scale}) scale(${scale})`}>
      <rect x="18" y="86" width="4" height="14" fill="#5b3a22" />
      {[0, 1, 2].map((i) => {
        const top = 8 + i * 24
        const w = 12 + i * 5
        return (
          <g key={i}>
            <path
              d={`M20 ${top} L${20 - w} ${top + 34} L${20 + w} ${top + 34} Z`}
              fill={shade}
            />
            {/* Snow on the branches. */}
            <path
              d={`M20 ${top} L${20 - w * 0.55} ${top + 16} L20 ${top + 12} L${20 + w * 0.45} ${top + 17} Z`}
              fill="#ffffff"
              opacity=".9"
            />
          </g>
        )
      })}
    </g>
  )
}

/** A cluster of snowy spruces on a snow drift, for the slope's edges. */
export function Pines({
  trees,
  className,
}: {
  /** [x, scale] per tree, left to right, in a 0–200 wide scene. */
  trees: [number, number][]
  className?: string
}) {
  const shades = ["#1f5a45", "#174a39", "#23654d"]
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 200 110"
      className={cn("block", className)}
      preserveAspectRatio="xMidYMax meet"
    >
      {trees.map(([x, s], i) => (
        <Spruce key={`${x}-${s}`} x={x} scale={s} shade={shades[i % 3]} />
      ))}
      <path d="M0 104 Q50 94 100 102 T200 100 V110 H0 Z" fill="#ffffff" />
    </svg>
  )
}
