import { randomUUID } from "node:crypto"
// Aliased: this is not a React hook, it reads the request cookie.
import { useSession as getSession } from "@tanstack/react-start/server"
import { env } from "@/env"

const secure = new URL(env.APP_URL).protocol === "https:"

/**
 * This browser's Puckopist id, from an encrypted HttpOnly cookie that's set
 * on first use. Players don't log in, so this is what runs and bans are tied
 * to. Clearing cookies gives a new one, which is why bans can also go by
 * browser fingerprint.
 */
export async function getDevice() {
  const session = await getSession<{ id?: string }>({
    name: "puckopist_device",
    password: env.SESSION_SECRET,
    maxAge: 60 * 60 * 24 * 365,
    cookie: { httpOnly: true, secure, sameSite: "lax", path: "/" },
  })
  if (session.data.id) return session.data.id
  const id = randomUUID()
  await session.update({ id })
  return id
}
