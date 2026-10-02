# syntax=docker/dockerfile:1

# La version de l'image Playwright doit correspondre à celle du paquet npm "playwright".
ARG PLAYWRIGHT_VERSION=1.63.0

# --- Étape de build : compile le TypeScript ---
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble AS build
WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# --- Image finale : Node + Chromium headless fournis par l'image Playwright ---
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble
WORKDIR /app
ENV NODE_ENV=production \
    TZ=Europe/Paris \
    DATA_DIR=/app/data \
    CONFIG_PATH=/app/config.yaml \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json config.yaml ./

# pwuser est l'utilisateur non-root fourni par l'image Playwright.
RUN mkdir -p /app/data && chown -R pwuser:pwuser /app/data
USER pwuser
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD ["node", "dist/healthcheck.js"]

CMD ["node", "dist/index.js"]
