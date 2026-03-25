FROM node:20-alpine
WORKDIR /app

# ─── Workspace setup (cached until any package.json changes) ──────────────────
COPY package*.json turbo.json tsconfig.base.json ./
COPY apps/api/package*.json     ./apps/api/
COPY apps/web/package*.json     ./apps/web/
COPY packages/shared-types/package*.json ./packages/shared-types/
COPY packages/config/package*.json       ./packages/config/
COPY packages/ui/package*.json           ./packages/ui/

# Install all deps (devDeps required for TypeScript build)
RUN npm install --include=dev

# ─── Source + build (cached until source changes) ─────────────────────────────
COPY . .

# 1. Build shared packages
RUN npx turbo run build --filter=@jdw/shared-types --filter=@jdw/config

# 2. Generate Prisma client
RUN cd apps/api && npx prisma generate

# 3. Compile NestJS → dist/
RUN cd apps/api && npm run build

# Guard: confirm main.js was produced
RUN ls apps/api/dist/main.js

EXPOSE 3001

# Run DB migrations, then start the API
CMD ["sh", "-c", "cd apps/api && npx prisma db push --skip-generate --accept-data-loss && node dist/main.js"]
