# Host-agnostic image — runs on Fly, Render, Railway, ECS, Cloud Run, or plain Docker.
# Deliberately not tied to one provider's build system.

# --- build ---------------------------------------------------------------------
FROM node:22-slim AS build
WORKDIR /app

# openssl is required by Prisma's query engine
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# --- run -----------------------------------------------------------------------
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# openssl for Prisma; postgresql-client so the release step can apply prisma/rls.sql
RUN apt-get update && apt-get install -y --no-install-recommends openssl postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package*.json ./

# Run as an unprivileged user.
USER node

EXPOSE 4000
# via npm so the entrypoint path lives in package.json only (the build emits dist/src/main.js)
CMD ["npm", "run", "start:prod"]

# Release/deploy step (run once per deploy, before the new image serves traffic):
#   npx prisma migrate deploy
#   psql "$DATABASE_URL" -v app_role="$APP_DB_ROLE" -f prisma/rls.sql
# DATABASE_URL here must be the OWNER role; the running container should connect as the
# NON-owner app role so FORCE ROW LEVEL SECURITY applies to it.
