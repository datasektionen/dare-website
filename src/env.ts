import { z } from "zod"

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.url(),
  /** Public base URL of this app, used to build the OIDC redirect URI. */
  APP_URL: z.url(),
  /** Key used to encrypt the session cookie. */
  SESSION_SECRET: z.string().min(32),
  OIDC_ISSUER: z.url(),
  OIDC_CLIENT_ID: z.string().min(1),
  OIDC_CLIENT_SECRET: z.string().min(1),
  /**
   * SSO's internal API (not the public OIDC issuer), used for profile
   * pictures. Production: http://sso.nomad.dsekt.internal. Without it,
   * avatars fall back to initials.
   */
  SSO_API_URL: z.url().optional(),
  /** `permissions` returns the user's Hive permissions in the `dare` system. */
  OIDC_SCOPES: z.string().default("openid profile email permissions"),
})

/** Server-only environment. Never import this from client code. */
export const env = envSchema.parse(process.env)
