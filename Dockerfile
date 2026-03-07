FROM node:25-alpine

# Set image label
LABEL org.opencontainers.image.source=https://github.com/count-collab/count-collab

WORKDIR /app

# Install bun
RUN npm install -g bun

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy application code
COPY . .

# Build application
RUN bun run build

# Expose port
EXPOSE 3000

# Start application
ENV NODE_ENV=production
ENV LOG_LEVEL=info
CMD ["node", "server.js"]
