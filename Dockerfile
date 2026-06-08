FROM node:20-alpine AS base

# Install dependencies needed for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++ gcc

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --production=false

# Copy source code
COPY . .

# Build the Next.js app
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

RUN apk add --no-cache python3 make g++ gcc

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy built app and dependencies
COPY --from=base /app/.next ./.next
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/public ./public
COPY --from=base /app/next.config.ts ./next.config.ts
COPY --from=base /app/tsconfig.json ./tsconfig.json

# Create persistent data directory for SQLite
RUN mkdir -p /data

# Add non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
RUN chown -R nextjs:nodejs /app /data
USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["npm", "start"]
