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

# Build info args (passed from CI where git is available)
ARG BUILD_COMMIT=unknown
ARG BUILD_BRANCH=unknown
ENV BUILD_COMMIT=$BUILD_COMMIT
ENV BUILD_BRANCH=$BUILD_BRANCH

# Copy application code
COPY . .

# Build application
RUN bun run build

# Setup cron job for inactive counter cleanup (daily at 3 AM UTC)
RUN echo '0 3 * * * . /app/.env.cron && cd /app && bun run scripts/cleanup-inactive-counters.ts >> /var/log/cron.log 2>&1' > /etc/crontabs/app \
    && chmod 0644 /etc/crontabs/app

# Copy and prepare entrypoint
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Expose port
EXPOSE 3000

# Start application
ENV NODE_ENV=production
ENV LOG_LEVEL=info
CMD ["./entrypoint.sh"]
