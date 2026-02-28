# ── Backend Dockerfile ────────────────────────────────────────────────────────
# Single-stage: Node.js has no compilation step, so a multi-stage build adds
# complexity without benefit here. The image stays lean via --omit=dev.

FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy manifests first — Docker caches this layer. The full npm ci only re-runs
# when package.json or package-lock.json actually change.
COPY package.json package-lock.json ./

# Install production dependencies only (excludes jest, babel-jest, nodemon).
RUN npm ci --omit=dev

# Copy application source after installing deps (maximises layer cache hits).
COPY . .

# Expose the port the app listens on. Value must match PORT env var.
EXPOSE 4000

# Run as the built-in non-root user that node:alpine provides.
# Prevents container processes from running as root — defence-in-depth.
USER node

CMD ["node", "app.js"]
