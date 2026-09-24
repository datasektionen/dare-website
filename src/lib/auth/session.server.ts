// Aliased: this is not a React hook, it reads the request cookie.
import { useSession as getSession } from "@tanstack/react-start/server"
import { env } from "@/env"
import type { User } from "./types"

const secure = new URL(env.APP_URL).protocol === "https:"

type AppSession = { user?: User }

/** The signed-in user's session, stored encrypted in an HttpOnly cookie. */
export function getAppSession() {
  return getSession<AppSession>({
    name: "dare_session",
    password: env.SESSION_SECRET,
    maxAge: 60 * 60 * 24 * 7,
    cookie: { httpOnly: true, secure, sameSite: "lax", path: "/" },
  })
}

type LoginFlow = {
  state?: string
  nonce?: string
  codeVerifier?: string
  redirectTo?: string
}

/** Short-lived cookie holding the OIDC state/nonce/PKCE verifier. */
export function getLoginFlowSession() {
  return getSession<LoginFlow>({
    name: "dare_oidc",
    password: env.SESSION_SECRET,
    maxAge: 60 * 10,
    cookie: { httpOnly: true, secure, sameSite: "lax", path: "/auth" },
  })
}
