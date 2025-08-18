# syntax=docker/dockerfile:1

# --- Base Node image ---
FROM node:22-bullseye AS base

# Install system dependencies: ffmpeg, python3, venv, build tools
RUN apt-get update && \
	apt-get install -y --no-install-recommends \
	ffmpeg \
	python3 \
	python3-venv \
	python3-pip \
	build-essential \
	git \
	ca-certificates && \
	rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --- deps: node deps + python venv (cached layers) ---
FROM base AS deps
ENV PIP_NO_CACHE_DIR=1

# Node deps cache
COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps ./apps
RUN npm ci --no-audit --no-fund

# Python venv cache keyed by requirements.txt
COPY requirements.txt ./requirements.txt
RUN python3 -m venv /app/venv && \
	. /app/venv/bin/activate && \
	pip install --upgrade pip && \
	pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch==2.2.2 && \
	pip install --no-cache-dir -r requirements.txt

# --- Build Next.js ---
FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# --- Runtime image ---
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# Copy runtime deps and build output
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=deps /app/requirements.txt ./requirements.txt
COPY --from=builder /app/src ./src
COPY --from=deps /app/venv ./venv

# Ensure ffmpeg present (in base layer) and python venv path for our code
ENV PYTHON_PATH=/app/venv/bin/python3

# Expose port
EXPOSE 8080

# Next.js expects PORT
ENV PORT=8080

# Start Next.js, bind to 0.0.0.0 for healthchecks
CMD ["sh", "-c", "npm run start -- -p ${PORT:-8080} -H 0.0.0.0"] 