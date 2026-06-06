FROM node:22-alpine AS base
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.5.2 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @deadlock/shared build
RUN pnpm --filter @deadlock/api prisma:generate
RUN pnpm --filter @deadlock/api build

EXPOSE 4000

CMD ["node", "apps/api/dist/server.js"]
