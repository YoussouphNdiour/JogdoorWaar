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
# Show resolved config (check for noEmit, outDir)
RUN cd apps/api && npx tsc --showConfig 2>&1 | grep -E '"noEmit|outDir|rootDir|include|files"' || true
# Compile with full diagnostics
RUN cd apps/api && npx tsc --project tsconfig.json --listEmittedFiles 2>&1; echo "tsc exit: $?"
# Show what was actually produced
RUN find /app/apps/api -name "*.js" -not -path "*/node_modules/*" 2>/dev/null | head -20; echo "--- find done ---"

# Guard: confirm main.js was produced
RUN ls apps/api/dist/main.js

EXPOSE 3001

# Run DB migrations, then start the API
CMD ["sh", "-c", "cd apps/api && npx prisma db push --skip-generate --accept-data-loss && node dist/main.js"]
