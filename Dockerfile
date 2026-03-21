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

# Expose port
EXPOSE 3000

# Runtime environment
ENV NODE_ENV=production
ENV LOG_LEVEL=info

# Proxy / TLS termination — adapter-node reads these at runtime.
# A reverse proxy (nginx, Caddy, ALB, etc.) MUST terminate TLS and
# forward the original client info via standard headers.
ENV PROTOCOL_HEADER=X-Forwarded-Proto
ENV HOST_HEADER=X-Forwarded-Host
ENV ADDRESS_HEADER=X-Forwarded-For
ENV XFF_DEPTH=1

# Required at runtime (no defaults — server.js validates on startup):
#   DATABASE_URL        – Postgres connection string
#   ALLOWED_ORIGINS     – Comma-separated list of allowed CORS origins
#   AUTH_SECRET          – Session encryption key for Auth.js

CMD ["node", "server.js"]
