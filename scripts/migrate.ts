import { existsSync } from "node:fs"
import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"

// Applies pending migrations on startup in production (see Dockerfile).
const migrationsFolder = process.env.MIGRATIONS_DIR ?? "./drizzle"
const url = process.env.DATABASE_URL
if (!url) throw new Error("DATABASE_URL is not set")

if (!existsSync(`${migrationsFolder}/meta/_journal.json`)) {
  console.log("No migrations to apply")
} else {
  const client = postgres(url, { max: 1 })
  await migrate(drizzle(client), { migrationsFolder })
  await client.end()
  console.log("Migrations applied")
}
