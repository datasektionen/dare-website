import { useMemo } from "react"
import { encode } from "uqr"

/** Quiet zone around the code, in modules. Scanners need at least 4. */
const BORDER = 4
const INK = "#0b1233"
const LOGO = { src: "/dare27-logo-black.png", ratio: 413 / 800 }
/** Rounding of outer corners, and of the inside corners where shapes meet. */
const R = 0.36
const FILLET = 0.22

type Shape = {
  size: number
  /** All dark modules as one path. */
  d: string
  /** The cleared box in the middle where the logo goes. */
  logo: { x: number; y: number; w: number; h: number }
}

/**
 * A classic QR code where neighbouring modules join up, with every outside
 * corner rounded and the inside corners softened. Error correction is at its
 * highest ("H", 30%), so the logo covering the middle still scans.
 */
function qrShape(value: string): Shape {
  const { data, size } = encode(value, { ecc: "H", border: BORDER })
  const inner = size - BORDER * 2

  // About a quarter of the width, centred, on whole modules.
  const w = Math.round(inner * 0.24)
  const h = Math.max(3, Math.round(w * LOGO.ratio) + 2)
  const logo = {
    x: Math.round((size - w) / 2),
    y: Math.round((size - h) / 2),
    w,
    h,
  }
  const inLogo = (x: number, y: number) =>
    x >= logo.x - 1 &&
    x < logo.x + w + 1 &&
    y >= logo.y - 1 &&
    y < logo.y + h + 1
  const on = (x: number, y: number) => !!data[y]?.[x] && !inLogo(x, y)

  let d = ""
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = on(x, y - 1)
      const r = on(x + 1, y)
      const b = on(x, y + 1)
      const l = on(x - 1, y)
      if (on(x, y)) {
        // A corner is rounded only where nothing joins it on either side.
        const tl = !t && !l ? R : 0
        const tr = !t && !r ? R : 0
        const br = !b && !r ? R : 0
        const bl = !b && !l ? R : 0
        d += `M${x} ${y + tl}`
        if (tl) d += `a${tl} ${tl} 0 0 1 ${tl} ${-tl}`
        d += `H${x + 1 - tr}`
        if (tr) d += `a${tr} ${tr} 0 0 1 ${tr} ${tr}`
        d += `V${y + 1 - br}`
        if (br) d += `a${br} ${br} 0 0 1 ${-br} ${br}`
        d += `H${x + bl}`
        if (bl) d += `a${bl} ${bl} 0 0 1 ${-bl} ${-bl}`
        d += "Z"
      } else {
        // An empty module boxed in on two sides gets a small fillet in that
        // corner, so joined shapes curve smoothly into each other.
        const f = FILLET
        if (t && l && on(x - 1, y - 1))
          d += `M${x} ${y}h${f}a${f} ${f} 0 0 0 ${-f} ${f}Z`
        if (t && r && on(x + 1, y - 1))
          d += `M${x + 1} ${y}v${f}a${f} ${f} 0 0 0 ${-f} ${-f}Z`
        if (b && r && on(x + 1, y + 1))
          d += `M${x + 1} ${y + 1}h${-f}a${f} ${f} 0 0 0 ${f} ${-f}Z`
        if (b && l && on(x - 1, y + 1))
          d += `M${x} ${y + 1}v${-f}a${f} ${f} 0 0 0 ${f} ${f}Z`
      }
    }
  }
  return { size, d, logo }
}

function svgBody(s: Shape, logoHref: string) {
  const pad = 0.4
  return `<rect width="${s.size}" height="${s.size}" fill="#fff"/><path d="${s.d}" fill="${INK}"/><image href="${logoHref}" x="${s.logo.x + pad}" y="${s.logo.y + pad}" width="${s.logo.w - pad * 2}" height="${s.logo.h - pad * 2}" preserveAspectRatio="xMidYMid meet"/>`
}

/** A QR code for `value`, scaling to its box. */
export function QrCode({
  value,
  title,
  className,
}: {
  value: string
  title: string
  className?: string
}) {
  const shape = useMemo(() => qrShape(value), [value])
  return (
    <svg
      viewBox={`0 0 ${shape.size} ${shape.size}`}
      role="img"
      aria-label={title}
      className={className}
      // Built from our own numbers and a fixed logo path only.
      // biome-ignore lint/security/noDangerouslySetInnerHtml: no user markup
      dangerouslySetInnerHTML={{ __html: svgBody(shape, LOGO.src) }}
    />
  )
}

/**
 * The same code as a standalone SVG file, e.g. to print on a poster. The
 * logo is embedded so the file works on its own.
 */
export async function qrSvgFile(value: string) {
  const blob = await (await fetch(LOGO.src)).blob()
  const logo = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
  const shape = qrShape(value)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${shape.size} ${shape.size}" width="1024" height="1024">${svgBody(shape, logo)}</svg>`
}
