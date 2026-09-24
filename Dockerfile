FROM docker.io/oven/bun:1.4-alpine AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build \
 && bun build scripts/migrate.ts --target=bun --outfile=.output/migrate.js

FROM docker.io/oven/bun:1.4-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/.output ./.output
COPY --from=build /app/drizzle ./drizzle

USER bun
# Apply pending migrations, then start the server (listens on $PORT).
CMD ["sh", "-c", "bun .output/migrate.js && exec bun .output/server/index.mjs"]

LABEL org.opencontainers.image.source="https://github.com/datasektionen/dare-website"
