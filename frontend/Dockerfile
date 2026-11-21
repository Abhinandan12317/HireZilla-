
# Stage 1: Build frontend and server
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY frontend ./frontend
COPY shared ./shared
COPY tsconfig.json ./

# Build React multi-page application
RUN npm run build:frontend

# Compile frontend Express server
RUN npx esbuild frontend/server.ts \
    --bundle \
    --platform=node \
    --format=esm \
    --packages=external \
    --outfile=frontend/server-build/server.mjs


# Stage 2: Production
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5173

# Production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled server
COPY --from=builder /app/frontend/server-build/server.mjs \
    ./frontend/server-build/server.mjs

# Server resolves its dist directory relative to its own location
COPY --from=builder /app/frontend/dist \
    ./frontend/server-build/dist

EXPOSE 5173

CMD ["node", "frontend/server-build/server.mjs"]
