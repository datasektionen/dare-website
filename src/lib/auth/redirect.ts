/** Only allow same-origin relative paths, to avoid open redirects. */
export function safeRedirect(path: string | null | undefined) {
  // Browsers treat a leading "/\" like "//", so reject both.
  if (!path?.startsWith("/") || path[1] === "/" || path[1] === "\\") return "/"
  return path
}
