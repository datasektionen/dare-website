import { z } from "zod"

/**
 * A ticket link people can open: a whole http(s) URL on a real domain, so no
 * `javascript:` and the like. Used by both the dashboard form and the server.
 */
export const ticketUrlSchema = z
  .string()
  .trim()
  .max(2000, "Länken är för lång.")
  .pipe(
    z.url({
      protocol: /^https?$/,
      hostname: z.regexes.domain,
      error: "Ange en hel länk som börjar med https://",
    })
  )
