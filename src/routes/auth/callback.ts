import { createFileRoute } from "@tanstack/react-router"
import * as client from "openid-client"
import { getOidcConfig, redirectUri } from "@/lib/auth/oidc.server"
import { hasAdminPermission } from "@/lib/auth/permissions"
import { getAppSession, getLoginFlowSession } from "@/lib/auth/session.server"
import { rememberJudgeName } from "@/lib/battle/judges.server"

export const Route = createFileRoute("/auth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const flow = await getLoginFlowSession()
        const { state, nonce, redirectTo } = flow.data
        await flow.clear()

        if (!state || !nonce) {
          return textResponse("Login session expired, please try again.", 400)
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
            { expectedState: state, expectedNonce: nonce }
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
          return textResponse("Login failed.", 400)
        }

        const name =
          userinfo.name ??
          [userinfo.given_name, userinfo.family_name].filter(Boolean).join(" ")
        // Judges added before SSO knew their name get it now.
        await rememberJudgeName(userinfo.sub, name)
        const session = await getAppSession()
        await session.update({
          user: {
            kthid: userinfo.sub,
            name,
            email: userinfo.email ?? "",
            // Anyone with an SSO account may log in; the `$dare:admin` Hive
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

/**
 * Without a Content-Type, the body is sent as application/octet-stream, which
 * Chrome treats as a failed download and shows ERR_INVALID_RESPONSE instead.
 */
function textResponse(body: string, status: number) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
