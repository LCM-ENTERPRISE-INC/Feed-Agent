# ==========================================================
# STAGE 1: Install dependencies and build the application
# ==========================================================
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install build dependencies for native modules if needed
RUN apt-get update && apt-get install -y python3 make g++ git

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

# Generate Prisma Client and build the TypeScript project
RUN npx prisma generate
RUN npm run build

# ==========================================================
# STAGE 2: Clean installation of production dependencies
# ==========================================================
FROM node:20-bookworm-slim AS production-deps

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# Install build deps for production-deps if needed
RUN apt-get update && apt-get install -y python3 make g++ git

# Install only production dependencies
RUN npm ci --omit=dev && npx prisma generate

# ==========================================================
# STAGE 3: Final Runner image
# ==========================================================
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install Tesseract OCR and Chromium for Puppeteer (whatsapp-web.js)
RUN apt-get update && apt-get install -y \
    tesseract-ocr tesseract-ocr-por \
    chromium \
    libnss3 libatk-bridge2.0-0 libcups2 libdrm2 \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Copy production dependencies
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=production-deps /app/package*.json ./

# Copy compiled code
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Create sessions and uploads directories with proper permissions
RUN mkdir -p sessions uploads logs && \
    chown -R node:node /app

# Run as non-root user for security hardening
USER node

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/index.js"]
