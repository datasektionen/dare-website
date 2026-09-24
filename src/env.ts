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
  OIDC_SCOPES: z.string().default("openid profile email"),
  HIVE_URL: z.url(),
  HIVE_API_TOKEN: z.string().min(1),
  /** Members of this Hive group (`id@domain`) are admins. */
  ADMIN_GROUP: z
    .string()
    .regex(/^[^@]+@[^@]+$/)
    .default("darestaben@datasektionen.se"),
})

/** Server-only environment. Never import this from client code. */
export const env = envSchema.parse(process.env)
