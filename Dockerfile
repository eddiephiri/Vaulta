# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests first (layer cache)
COPY package.json package-lock.json ./

# Install all deps (including devDeps needed for build)
RUN npm ci

# Copy project source
COPY . .

# Vite bakes VITE_* vars into the bundle at build time — inject via build args
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_VAPID_KEY

# SECURITY: ARGs are available during build without ENV.
# Avoid ENV so secrets don't persist in image layer metadata.

# Build the production bundle
RUN npm run build

# ─── Stage 2: Serve ──────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS server

# Remove the default Nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our SPA-aware Nginx config
COPY nginx.conf /etc/nginx/conf.d/fleetflow.conf

# Copy built assets from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
