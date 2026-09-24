import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { env } from "@/env"
import * as schema from "./schema"

// Reuse the connection across Vite HMR reloads in development.
const globalForDb = globalThis as unknown as {
  client?: ReturnType<typeof postgres>
}

const client = globalForDb.client ?? postgres(env.DATABASE_URL)
if (env.NODE_ENV !== "production") globalForDb.client = client

export const db = drizzle(client, { schema, casing: "snake_case" })
