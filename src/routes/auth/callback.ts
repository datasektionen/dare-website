import { createFileRoute } from "@tanstack/react-router"
import * as client from "openid-client"
import { getOidcConfig, redirectUri } from "@/lib/auth/oidc.server"
import { hasAdminPermission } from "@/lib/auth/permissions"
import { getAppSession, getLoginFlowSession } from "@/lib/auth/session.server"

export const Route = createFileRoute("/auth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const flow = await getLoginFlowSession()
        const { state, nonce, codeVerifier, redirectTo } = flow.data
        await flow.clear()

        if (!state || !nonce || !codeVerifier) {
          return new Response("Login session expired, please try again.", {
            status: 400,
          })
        }

        const config = await getOidcConfig()
        // Rebuild the URL from the public redirect URI: behind a proxy,
        // request.url has the internal host.
        const currentUrl = new URL(redirectUri)
        currentUrl.search = new URL(request.url).search

        let userinfo: client.UserInfoResponse
        try {
          const tokens = await client.authorizationCodeGrant(
            config,
            currentUrl,
            {
              expectedState: state,
              expectedNonce: nonce,
              pkceCodeVerifier: codeVerifier,
            }
          )
          const sub = tokens.claims()?.sub
          if (!sub) throw new Error("ID token is missing `sub`")
          userinfo = await client.fetchUserInfo(
            config,
            tokens.access_token,
            sub
          )
        } catch (error) {
          console.error("OIDC callback failed", error)
          return new Response("Login failed.", { status: 400 })
        }

        const session = await getAppSession()
        await session.update({
          user: {
            kthid: userinfo.sub,
            name:
              userinfo.name ??
              [userinfo.given_name, userinfo.family_name]
                .filter(Boolean)
                .join(" "),
            email: userinfo.email ?? "",
            // Anyone with an SSO account may log in; the `dare:admin` Hive
            // permission, which SSO includes in userinfo, makes you an admin.
            isAdmin: hasAdminPermission(userinfo.permissions),
          },
        })

        return new Response(null, {
          status: 302,
          headers: { Location: redirectTo ?? "/" },
        })
      },
    },
  },
})
