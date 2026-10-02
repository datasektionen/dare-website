/*
 * Deterministic maths for the Puckopist simulation.
 *
 * The server replays every run to check its score, so the simulation has to
 * give bit-for-bit the same result in every browser and on the server. `+`,
 * `-`, `*`, `/` and `Math.sqrt` are exact in IEEE 754, but `Math.sin`,
 * `Math.atan`, `Math.exp`, `Math.hypot` and `**` are left to each engine
 * and differ in the last bits between V8, JavaScriptCore and SpiderMonkey.
 * These are built from the exact operations only, so they agree everywhere.
 */

const PI = Math.PI
const HALF_PI = PI / 2
const TAU = PI * 2

/** sin for |x| ≤ π/2, Taylor series to x^23 (error far below 1e-16). */
function sinSmall(x: number) {
  const x2 = x * x
  let term = x
  let sum = x
  for (let n = 2; n <= 22; n += 2) {
    term = (-term * x2) / (n * (n + 1))
    sum += term
  }
  return sum
}

export function sin(x: number) {
  // Into [-π, π], then fold into [-π/2, π/2] using sin(π - x) = sin(x).
  let r = x - Math.round(x / TAU) * TAU
  if (r > HALF_PI) r = PI - r
  else if (r < -HALF_PI) r = -PI - r
  return sinSmall(r)
}

export function cos(x: number) {
  return sin(x + HALF_PI)
}

/** atan for |x| ≤ ~0.2, Taylor series to x^29. */
function atanSmall(x: number) {
  const x2 = x * x
  let p = x
  let sum = x
  for (let n = 3; n <= 29; n += 2) {
    p *= -x2
    sum += p / n
  }
  return sum
}

export function atan(x: number): number {
  if (Number.isNaN(x)) return x
  if (x < 0) return -atan(-x)
  if (x > 1) return HALF_PI - atan(1 / x)
  // Halve the angle twice: atan(x) = 2·atan(x / (1 + √(1 + x²))).
  const a = x / (1 + Math.sqrt(1 + x * x))
  const b = a / (1 + Math.sqrt(1 + a * a))
  return 4 * atanSmall(b)
}

/** e^x, by squaring a Taylor series of e^(x / 2^k). */
export function exp(x: number) {
  let k = 0
  let r = x
  while (r > 0.5 || r < -0.5) {
    r /= 2
    k++
  }
  let term = 1
  let sum = 1
  for (let n = 1; n <= 20; n++) {
    term = (term * r) / n
    sum += term
  }
  for (let i = 0; i < k; i++) sum *= sum
  return sum
}

export function hypot(a: number, b: number) {
  return Math.sqrt(a * a + b * b)
}
