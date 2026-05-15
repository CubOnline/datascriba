# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN corepack enable pnpm

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/report-engine/package.json ./packages/report-engine/
COPY packages/db-drivers/package.json ./packages/db-drivers/
COPY packages/ai-client/package.json ./packages/ai-client/
COPY packages/queue-config/package.json ./packages/queue-config/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/eslint-config/package.json ./packages/eslint-config/
RUN pnpm install --frozen-lockfile --ignore-scripts

# Builder
FROM deps AS builder
WORKDIR /app
COPY . .
RUN pnpm --filter=@datascriba/tsconfig build 2>/dev/null || true
RUN pnpm --filter=@datascriba/shared-types build 2>/dev/null || true
RUN pnpm --filter=@datascriba/queue-config build 2>/dev/null || true
RUN pnpm --filter=@datascriba/db-drivers build 2>/dev/null || true
RUN pnpm --filter=@datascriba/report-engine build 2>/dev/null || true
RUN pnpm --filter=@datascriba/ai-client build 2>/dev/null || true
RUN pnpm --filter=@datascriba/api build

# Development
FROM deps AS development
WORKDIR /app
COPY . .
EXPOSE 3001
CMD ["pnpm", "--filter=api", "dev"]

# Production
FROM node:22-alpine AS production
RUN corepack enable pnpm
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 node

COPY --from=builder --chown=node:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=node:nodejs /app/apps/api/package.json ./apps/api/
COPY --from=builder --chown=node:nodejs /app/packages ./packages
COPY --from=builder --chown=node:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=node:nodejs /app/package.json ./
COPY --from=builder --chown=node:nodejs /app/pnpm-workspace.yaml ./

USER node
EXPOSE 3001
CMD ["node", "apps/api/dist/main"]
