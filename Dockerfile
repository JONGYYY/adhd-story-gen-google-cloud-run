# syntax=docker/dockerfile:1

# --- Base Node image ---
FROM node:20-bullseye AS base

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

# --- Dependencies layer ---
FROM base AS deps

# Copy only package files to leverage caching
COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps ./apps

RUN npm ci --no-audit --no-fund

# --- Build Next.js ---
FROM deps AS builder

# Copy the rest of the repo
COPY . .

# Disable telemetry
ENV NEXT_TELEMETRY_DISABLED 1

# Build Next.js
RUN npm run build

# Create Python venv and install requirements for video processing
RUN python3 -m venv /app/venv && \
	. /app/venv/bin/activate && \
	pip install --upgrade pip && \
	pip install -r requirements.txt

# --- Runtime image ---
FROM base AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# Copy node_modules and built app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/requirements.txt ./requirements.txt
COPY --from=builder /app/src ./src
COPY --from=builder /app/venv ./venv

# Ensure ffmpeg present (in base layer) and python venv path for our code
ENV PYTHON_PATH=/app/venv/bin/python3

# Expose port
EXPOSE 8080

# Next.js expects PORT
ENV PORT=8080

# Use dynamic $PORT if provided by the platform
CMD ["sh", "-c", "npm run start -- -p ${PORT:-8080}"] 