import type { Side } from "@/lib/battle/types"

/** The Jäger and Minttu scoring buttons: warm fire and icy blue. */
export const SIDE_BUTTON: Record<Side, string> = {
  jaeger:
    "bg-[linear-gradient(135deg,#7a1405,#ff3d2e_55%,#ff7a1a)] text-white shadow-[0_8px_30px_rgba(255,80,30,.35)] hover:brightness-110",
  minttu:
    "bg-[linear-gradient(135deg,#0b1f6b,#2a7bff_45%,#3dd6ff)] text-white shadow-[0_8px_30px_rgba(40,150,255,.35)] hover:brightness-110",
}

/** Small side markers and score numbers, dark enough to read on snow. */
export const SIDE_DOT: Record<Side, string> = {
  jaeger: "bg-[#ff5a1f]",
  minttu: "bg-[#2a7bff]",
}
export const SIDE_TEXT: Record<Side, string> = {
  jaeger: "text-[#e0431d]",
  minttu: "text-[#1a64e0]",
}
