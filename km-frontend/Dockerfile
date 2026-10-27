# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# NEXT_PUBLIC_* values are compiled into the site by "npm run build", so they must be build
# arguments (Dokploy: Build-time Arguments, or compose build args). Runtime environment variables
# are too late for them. Empty means "use the default in src/config/features.ts".
ARG NEXT_PUBLIC_API_URL=https://api.kaammilega.com
ARG NEXT_PUBLIC_ENABLE_DARK_MODE=
ARG NEXT_PUBLIC_ENABLE_INSTANT_MILEGA=
ARG NEXT_PUBLIC_RAZORPAY_KEY_ID=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_ENABLE_DARK_MODE=$NEXT_PUBLIC_ENABLE_DARK_MODE
ENV NEXT_PUBLIC_ENABLE_INSTANT_MILEGA=$NEXT_PUBLIC_ENABLE_INSTANT_MILEGA
ENV NEXT_PUBLIC_RAZORPAY_KEY_ID=$NEXT_PUBLIC_RAZORPAY_KEY_ID

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy all source code
COPY . .

# Build Next.js app (NEXT_PUBLIC_ vars are baked in here)
RUN npm run build

# Runner stage — minimal image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
