# Stage 1: Dependencies
FROM node:22-alpine AS dependencies
WORKDIR /app

COPY package.json package-lock.json ./

# Clean install with legacy peer deps to handle platform-specific optional peer bindings
RUN npm ci --legacy-peer-deps

# Stage 2: Build
FROM node:22-alpine AS build
WORKDIR /app

# Accept build arguments for frontend bundling
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ARG SUPABASE_URL
ARG SUPABASE_PUBLISHABLE_KEY
ARG SUPABASE_PROJECT_ID

# Set build-time environment variables for Vite and Nitro
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL:-$SUPABASE_URL} \
    VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY:-$SUPABASE_PUBLISHABLE_KEY} \
    VITE_SUPABASE_PROJECT_ID=${VITE_SUPABASE_PROJECT_ID:-$SUPABASE_PROJECT_ID} \
    SUPABASE_URL=${SUPABASE_URL:-$VITE_SUPABASE_URL} \
    SUPABASE_PUBLISHABLE_KEY=${SUPABASE_PUBLISHABLE_KEY:-$VITE_SUPABASE_PUBLISHABLE_KEY} \
    SUPABASE_PROJECT_ID=${SUPABASE_PROJECT_ID:-$VITE_SUPABASE_PROJECT_ID} \
    NITRO_PRESET=node-server \
    NODE_ENV=production

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN npm run build

# Stage 3: Production Runtime
FROM node:22-alpine AS production
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

# Copy the built Nitro server and static outputs
COPY --chown=node:node --from=build /app/.output ./.output
# Copy runtime dependencies and package metadata
COPY --chown=node:node --from=dependencies /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/package.json ./package.json

# Switch to non-root user
USER node

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
