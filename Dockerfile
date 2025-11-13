# ---- deps ----
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* yarn.lock* ./
RUN npm ci

# ---- build ----
FROM node:18-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# declare the build-time argument.
ARG NEXT_PUBLIC_WEBSOCKET_SERVER_URL

# Set it as an environment variable *for this build stage*.
ENV NEXT_PUBLIC_WEBSOCKET_SERVER_URL=$NEXT_PUBLIC_WEBSOCKET_SERVER_URL

RUN npm run build

# ---- run ----
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

# Only the standalone server and static assets
COPY --from=build --chown=nextjs:nextjs /app/public ./public
COPY --from=build --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nextjs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]