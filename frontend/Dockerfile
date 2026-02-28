# ── Frontend Dockerfile ───────────────────────────────────────────────────────
# Two-stage build:
#   Stage 1 (builder): Node — installs deps and compiles TypeScript + Vite bundle.
#   Stage 2 (runtime): nginx — serves the static bundle; Node is not in the final
#                      image, keeping it small (~25 MB vs ~200 MB).

# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy manifests first for layer caching.
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build.
# VITE_API_URL can be injected at build time via --build-arg if the frontend
# uses import.meta.env.VITE_API_URL. If it uses relative URLs (routed via nginx)
# no build arg is needed.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY . .
RUN npm run build
# dist/ now contains the production-ready static assets.

# ── Stage 2: serve ────────────────────────────────────────────────────────────
FROM nginx:alpine

# Replace nginx's default config with ours (SPA routing + API proxy).
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the compiled bundle from the builder stage.
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# nginx is PID 1 in the container; run it in the foreground so Docker can manage
# the lifecycle and capture stdout/stderr logs.
CMD ["nginx", "-g", "daemon off;"]
