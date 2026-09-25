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
a mock of SSO on <http://localhost:7003>. Clicking **Logga in** sends
you to its login page. Enter one of the users from `dev/nyckeln.yaml`:

| kth_id    | Who                                              |
| --------- | ------------------------------------------------ |
| `turetek` | admin (dÅrestaben, which has `dare:admin`)       |
| `nollan`  | regular chapter member                           |
| `gaest`   | KTH user outside the chapter (guest)             |

To add users, group members or permissions, edit `dev/nyckeln.yaml` and run
`docker compose restart sso`.

## Auth

- `/auth/login` starts an OIDC authorization code flow (with PKCE) against
  `OIDC_ISSUER`. `/auth/callback` fetches userinfo and stores the user in an
  **encrypted HttpOnly cookie** (`dare_session`, 7 days). `POST /auth/logout`
  clears it. No auth tables live in the database.
- **Anyone with an SSO account can log in.** Admins are those with the Hive
  permission `dare:admin` (permission `admin` in the Hive system `dare`).
  SSO includes it in userinfo through the `permissions` scope, so the app never
  calls Hive itself. It's read at login, so changes in Hive apply at the next
  login. The user is `{ kthid, name, email, isAdmin }`.
- **Pages:** put protected routes under `src/routes/_authed/`. `context.user`
  is non-null there. Gate admin-only content on `context.user.isAdmin` (see
  `_authed/dashboard.tsx`).
- **Server functions:** use `.middleware([authMiddleware])` or
  `.middleware([adminMiddleware])` from `@/lib/auth/functions`. Always check
  on the server; route guards only affect the UI.

## Dashboard

`/dashboard` has a sidebar (a slide-out menu on phones) with one page per
area. Pages under `src/routes/_authed/dashboard/_admin/` are for admins only.

| Page | Who | What |
| --- | --- | --- |
| Översikt | all | Summary tiles, quick scoring and recent activity |
| Profil | all | Account, permission, theme, log out |
| Jäger vs Minttu | admins | Score the battle, who has scored most |
| Biljettsläpp | admins | The ticket release time the landing page counts down to |
| Aktivitet | admins | Everything admins have changed, filterable with tabs |
| Inställningar | admins | Switch optional features on and off (below) |

### Features

Parts of the site that are only needed for a while can be switched off under
**Inställningar**. Switched-off features are hidden from the dashboard and the
activity log, and the server refuses changes to them. Nothing is deleted.
Switches are stored in `site_settings` and logged in `feature_changes`.

| Feature | Default | When off |
| --- | --- | --- |
| Biljettsläpp | on | The landing page stays, but without the countdown numbers |
| Jäger vs Minttu | off | `/battle` redirects to the start page |

Profile pictures (avatars) come from `/api/avatar/<kthid>`, which looks them
up in SSO's internal API (`SSO_API_URL`; SSO gets them from rfinger) and
redirects to them. The links expire, so they're only cached in memory for a
few hours. Without `SSO_API_URL`, avatars show initials.

The ticket release time is stored in `site_settings` (a single row), and every
change is logged in `ticket_release_changes`. Until an admin sets a time,
4 November 2026 20:00 is used. Times are entered and shown in Swedish time
(`src/lib/time.ts`).

## Jäger vs Minttu (`/battle`)

**Off by default.** It's only used at the ticket release pub, so switch it on
under **Inställningar** before the pub and off afterwards. While it's off,
`/battle` redirects to the start page, it's hidden from the dashboard and the
activity log, and the server refuses scoring. The scores are kept, so start a
new round with **Nollställ** next time.

A full-screen battle for the big screen, based on
[haaker1/haaker1.github.io](https://github.com/haaker1/haaker1.github.io)
(images from there, in `public/battle/`). The fighters are pushed towards the
side that's behind, and every point triggers sparks, a shockwave, screen shake
and an impact word. The page has no controls: press **F** for fullscreen.

- Admins score only from the **Jäger vs Minttu** card on `/dashboard` (made
  for phones). `/battle` itself is read-only.
- The score is in the `battle` table, and every hit, undo and reset is logged
  in `battle_events`.
- Updates reach every open screen instantly through server-sent events
  (`/api/battle/events`), fanned out between app instances with Postgres
  `LISTEN`/`NOTIFY`. Screens also poll every 15 s as a fallback.

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
3. **Hive:** create the system `dare` with a permission `admin`, and assign it
   to the group `darestaben@datasektionen.se`. Members of its subgroups get it
   too, and only while their membership is active.
4. **SSO client:** in SSO's admin panel, create client `dare` with redirect URI
   `https://xn--dre-ula.se/auth/callback` and **Hive system `dare`**. Without the
   Hive system, SSO rejects logins that request `permissions`. Allow guests if
   people outside the chapter should be able to log in.
5. **Nomad variables** at `nomad/jobs/dare`: `db_password`, `session_secret`
   (`openssl rand -base64 32`), `oidc_client_secret`.
6. **DNS:** point `dåre.se` (`xn--dre-ula.se`) at the cluster.
