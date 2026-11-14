# syntax=docker/dockerfile:1
#
# The LifeGuessr image: the Next.js standalone server (apps/web) on Node 22. The build context is
# the repository root, streamed from `git archive` by deploy/deploy.sh. `-slim` is Debian, which
# has the glibc that the Next SWC and Tailwind binaries expect.

# ---------------------------------------------------------------- build
FROM node:22-slim AS builder
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    BUILD_STANDALONE=1
# pnpm comes from "packageManager" in package.json.
RUN corepack enable

# Install first, from the manifests only, so this layer is reused until a dependency changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/types/package.json packages/types/
COPY packages/engine/package.json packages/engine/
COPY packages/data/package.json packages/data/
RUN pnpm install --frozen-lockfile

# Only what `next build` reads. Docs, CI files and the root lint config stay out, so editing them
# does not rebuild the app.
COPY tsconfig.base.json ./
COPY apps apps
COPY packages packages

# NEXT_PUBLIC_* values are written into the client bundle at build time, not read at run time, so
# they are build arguments. deploy.sh passes the values from the server's .env. Defaults match
# .env.example. None of them is a secret.
# NEXT_PUBLIC_GAME_MODE: /play is the duel unless `slider` (the rollback). NEXT_PUBLIC_DUEL_SOURCE:
# the duel plays in the browser (`fixtures`) until its server routes land (#115, #120).
ARG NEXT_PUBLIC_GAME_SOURCE=fixtures
ARG NEXT_PUBLIC_SESSION_SOURCE=local
ARG NEXT_PUBLIC_EVENTS_SOURCE=off
ARG NEXT_PUBLIC_AVATARS_ENABLED=false
ARG NEXT_PUBLIC_GAME_MODE=duel
ARG NEXT_PUBLIC_DUEL_SOURCE=fixtures
ENV NEXT_PUBLIC_GAME_SOURCE=$NEXT_PUBLIC_GAME_SOURCE \
    NEXT_PUBLIC_SESSION_SOURCE=$NEXT_PUBLIC_SESSION_SOURCE \
    NEXT_PUBLIC_EVENTS_SOURCE=$NEXT_PUBLIC_EVENTS_SOURCE \
    NEXT_PUBLIC_AVATARS_ENABLED=$NEXT_PUBLIC_AVATARS_ENABLED \
    NEXT_PUBLIC_GAME_MODE=$NEXT_PUBLIC_GAME_MODE \
    NEXT_PUBLIC_DUEL_SOURCE=$NEXT_PUBLIC_DUEL_SOURCE
# `public/` is optional in Next; the runner stage copies it, so make sure it exists.
RUN mkdir -p apps/web/public && pnpm --filter web build

# ---------------------------------------------------------------- run
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    PRO_DATA_DIR=/data/pro

# A new named volume takes the owner of the image's directory, so creating /data for the app user
# here is what makes it writable. It holds the Pro entitlement file of the pre-store builds (and
# the file store when STORE_URL is unset); sessions and the rest live in the postgres service.
RUN mkdir -p /data && chown node:node /data

# `.next/standalone` is the server plus the node_modules it needs. It leaves out `.next/static`
# and `public`, so they are copied next to it. The tracing root is the repo root
# (apps/web/next.config.ts), so the app sits at apps/web inside the standalone folder.
COPY --from=builder --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /repo/apps/web/public ./apps/web/public

USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
