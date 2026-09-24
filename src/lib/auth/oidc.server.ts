import * as client from "openid-client"
import { env } from "@/env"

let configPromise: Promise<client.Configuration> | undefined

/** Discovers and caches the SSO provider configuration. */
export function getOidcConfig() {
  configPromise ??= client
    .discovery(
      new URL(env.OIDC_ISSUER),
      env.OIDC_CLIENT_ID,
      undefined,
      client.ClientSecretBasic(env.OIDC_CLIENT_SECRET),
      // The local SSO mock is served over plain http.
      env.OIDC_ISSUER.startsWith("http://")
        ? { execute: [client.allowInsecureRequests] }
        : undefined
    )
    .catch((error) => {
      configPromise = undefined
      throw error
    })
  return configPromise
}

export const redirectUri = new URL("/auth/callback", env.APP_URL).toString()
