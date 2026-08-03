# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build-time API URL (passed from Dokploy build args)
ARG NEXT_PUBLIC_API_URL=https://api.kaammilega.com
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

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
