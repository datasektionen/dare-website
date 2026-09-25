import { createFileRoute } from "@tanstack/react-router"
import { env } from "@/env"
import { getAppSession } from "@/lib/auth/session.server"

/*
 * Profile pictures, for logged-in users only. Looks up the picture link in
 * SSO's internal API (which gets it from rfinger) and redirects to it. The
 * links expire, so they're only cached for a few hours, never stored.
 */

const HIT_TTL = 6 * 60 * 60 * 1000
const MISS_TTL = 60 * 60 * 1000

const globalForAvatars = globalThis as unknown as {
  avatarCache?: Map<string, { url: string | null; expires: number }>
}
globalForAvatars.avatarCache ??= new Map()
const cache = globalForAvatars.avatarCache

async function lookup(kthid: string): Promise<string | null> {
  if (!env.SSO_API_URL) return null
  const hit = cache.get(kthid)
  if (hit && hit.expires > Date.now()) return hit.url
  let url: string | null = null
  try {
    const res = await fetch(
      `${env.SSO_API_URL}/api/users?format=single&picture=thumbnail&u=${encodeURIComponent(kthid)}`,
      { signal: AbortSignal.timeout(3000) }
    )
    if (res.ok) {
      const user: { picture?: string } = await res.json()
      url = user.picture || null
    } else if (res.status !== 404) {
      // Don't cache errors; try again next time.
      return null
    }
  } catch {
    return null
  }
  cache.set(kthid, { url, expires: Date.now() + (url ? HIT_TTL : MISS_TTL) })
  return url
}

export const Route = createFileRoute("/api/avatar/$kthid")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const session = await getAppSession()
        if (!session.data.user) return new Response(null, { status: 401 })
        if (!/^[a-z0-9]{2,16}$/i.test(params.kthid))
          return new Response(null, { status: 400 })

        const url = await lookup(params.kthid.toLowerCase())
        if (!url)
          return new Response(null, {
            status: 404,
            headers: { "Cache-Control": "private, max-age=600" },
          })
        return new Response(null, {
          status: 302,
          headers: { Location: url, "Cache-Control": "private, max-age=3600" },
        })
      },
    },
  },
})
