# Use Node.js 20 based on project requirement
FROM node:20-alpine AS builder

# Set working directory for the app
WORKDIR /app

# Copy package.json and lock files (safe for both root and subfolder context)
COPY package.json package-lock.json* ./
COPY km-frontend/package.json km-frontend/package-lock.json* ./

# Install dependencies (production & dev required for build)
RUN npm ci

# Copy the rest of the application code
COPY . .

# Ensure km-frontend files take precedence if built from root
RUN if [ -d "./km-frontend" ]; then \
        cp -rf ./km-frontend/* /app/; \
    fi

# Build the Next.js application
RUN npm run build

# Start a new stage for a smaller final image
FROM node:20-alpine AS runner

WORKDIR /app

# Set environment to production
ENV NODE_ENV=production

# Copy necessary files from builder stage
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]
