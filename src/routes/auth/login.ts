import { createFileRoute } from "@tanstack/react-router"
import * as client from "openid-client"
import { env } from "@/env"
import { getOidcConfig, redirectUri } from "@/lib/auth/oidc.server"
import { safeRedirect } from "@/lib/auth/redirect"
import { getLoginFlowSession } from "@/lib/auth/session.server"

export const Route = createFileRoute("/auth/login")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const config = await getOidcConfig()
        const state = client.randomState()
        const nonce = client.randomNonce()
        const codeVerifier = client.randomPKCECodeVerifier()

        const flow = await getLoginFlowSession()
        await flow.update({
          state,
          nonce,
          codeVerifier,
          redirectTo: safeRedirect(
            new URL(request.url).searchParams.get("redirect")
          ),
        })

        const url = client.buildAuthorizationUrl(config, {
          redirect_uri: redirectUri,
          scope: env.OIDC_SCOPES,
          state,
          nonce,
          code_challenge: await client.calculatePKCECodeChallenge(codeVerifier),
          code_challenge_method: "S256",
        })
        // Not Response.redirect(): its headers are immutable, and Start needs to
        // append the Set-Cookie header.
        return new Response(null, {
          status: 302,
          headers: { Location: url.toString() },
        })
      },
    },
  },
})
