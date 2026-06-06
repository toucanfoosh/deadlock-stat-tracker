FROM node:22-alpine AS base
WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN corepack enable
RUN corepack pnpm install --frozen-lockfile

COPY . .

RUN corepack pnpm --filter @deadlock/shared build
RUN corepack pnpm --filter @deadlock/api prisma:generate
RUN corepack pnpm --filter @deadlock/api build

EXPOSE 4000

CMD ["node", "apps/api/dist/server.js"]
