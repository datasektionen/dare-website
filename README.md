# dare-website

Dåre's website. TanStack Start + Tailwind v4 + shadcn/ui (Base UI, Lyra, Mist)
+ Drizzle + Postgres, with login through
[Datasektionen SSO](https://github.com/datasektionen/sso). Runs on Bun and
deploys to Datasektionen's Nomad cluster.

## Getting started

```sh
bun install
cp .env.example .env     # then set SESSION_SECRET (openssl rand -base64 32)
bun run services:up      # Postgres + SSO mock (docker compose)
bun run db:migrate
bun run dev              # http://localhost:3000
```

### Logging in locally

`docker-compose.yml` runs
[nyckeln-under-dorrmattan](https://github.com/datasektionen/nyckeln-under-dorrmattan),
a mock of SSO (<http://localhost:7003>) and Hive (<http://localhost:7004>). Clicking **Logga in** sends
you to its login page. Enter one of the users from `dev/nyckeln.yaml`:

| kth_id    | Who                                              |
| --------- | ------------------------------------------------ |
| `turetek` | admin (member of Hive group `darestaben`)        |
| `nollan`  | regular chapter member                           |
| `gaest`   | KTH user outside the chapter (guest)             |

To add users or group members, edit `dev/nyckeln.yaml` and run
`docker compose restart sso`.

## Auth

- `/auth/login` starts an OIDC authorization code flow (with PKCE) against
  `OIDC_ISSUER`. `/auth/callback` fetches userinfo and stores the user in an
  **encrypted HttpOnly cookie** (`dare_session`, 7 days). `POST /auth/logout`
  clears it. No auth tables live in the database.
- **Anyone with an SSO account can log in.** Hive is only used to decide who
  is admin. The user is `{ kthid, name, email, isAdmin }`, and `isAdmin` means
  they're a member of the Hive group `ADMIN_GROUP` (default
  `darestaben@datasektionen.se`, dÅrestaben). It's checked at login via Hive's
  `/group/{domain}/{id}/members`, so membership changes apply at the next login.
  If Hive is down, users log in as non-admins.
- **Pages:** put protected routes under `src/routes/_authed/`. `context.user`
  is non-null there. Gate admin-only content on `context.user.isAdmin` (see
  `_authed/dashboard.tsx`).
- **Server functions:** use `.middleware([authMiddleware])` or
  `.middleware([adminMiddleware])` from `@/lib/auth/functions`. Always check
  on the server; route guards only affect the UI.

## Admin

Admins (members of dÅrestaben) get an editor on `/dashboard` for the **ticket
release time** that the landing page counts down to. It's stored in the
`site_settings` table (a single row), and every change is logged in
`ticket_release_changes` with who made it. Until an admin sets a time,
4 November 2026 20:00 is used. Times are entered and shown in Swedish time
(`src/lib/time.ts`).

## Scripts

| Script                        | What it does                                    |
| ----------------------------- | ----------------------------------------------- |
| `dev`                         | Vite dev server on port 3000                    |
| `build` / `start`             | Production build to `.output/`, serve with Bun  |
| `test` / `test:watch`         | Vitest                                          |
| `check`                       | Biome lint + format (writes fixes)              |
| `typecheck`                   | `tsc --noEmit`                                  |
| `services:up` / `services:down` | Start / stop Postgres and the SSO mock        |
| `db:generate`                 | Generate a SQL migration from schema changes    |
| `db:migrate`                  | Apply pending migrations                        |
| `db:push` / `db:studio`       | Push schema directly / open Drizzle Studio      |

## Database

Add tables in `src/db/schema/` and export them from `index.ts`. Then run
`bun run db:generate` and `bun run db:migrate`, and commit the files in `drizzle/`.
In production, the container applies pending migrations on startup
(`scripts/migrate.ts`).

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`, which uses
[`datasektionen/nomad-deploy`](https://github.com/datasektionen/nomad-deploy)
to build the `Dockerfile`, push it to `ghcr.io/datasektionen/dare-website` and
run `job.nomad.hcl` (job `dare`, namespace `default`, host `dåre.se`).

One-time setup, done by D-Sys:

1. **Deploy token:** add `"dare-website"` to the `default` list in
   `deploy-tokens` in [infra/github.tf](https://github.com/datasektionen/infra/blob/main/github.tf).
   This creates the repo's `NOMAD_TOKEN` secret.
2. **Database:** create user and database `dare` on `postgres.dsekt.internal`.
3. **SSO client:** in SSO's admin panel, create client `dare` with redirect URI
   `https://xn--dre-ula.se/auth/callback`, and allow guests if people outside
   the chapter should be able to log in.
4. **Hive:** create a system `dare` with an API token that has
   `$hive:api-list-tagged`. Tag the `darestaben` group with a tag that belongs
   to `dare`; Hive only lists members of groups tagged for the calling system.
5. **Nomad variables** at `nomad/jobs/dare`: `db_password`, `session_secret`
   (`openssl rand -base64 32`), `oidc_client_secret`, `hive_api_token`.
6. **DNS:** point `dåre.se` (`xn--dre-ula.se`) at the cluster.
