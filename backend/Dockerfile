
# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies using root lockfile
COPY package.json package-lock.json ./
RUN npm ci

# Copy application source
COPY backend ./backend
COPY shared ./shared
COPY tsconfig.json ./

# Compile backend
RUN npm run build:backend


# Stage 2: Production
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV BACKEND_PORT=4000

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled backend
COPY --from=builder /app/backend/dist ./backend/dist

# Runtime directories
RUN mkdir -p /app/data /app/private_storage \
    && chown -R node:node /app

USER node

EXPOSE 4000

CMD ["node", "backend/dist/server.mjs"]