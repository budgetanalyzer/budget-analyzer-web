# Development Dockerfile - runs Vite dev server with HMR
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293

WORKDIR /app

RUN addgroup -S app -g 1001 \
    && adduser -S app -u 1001 -G app

# Copy package files
COPY package*.json ./

# Install dependencies before dropping root, then hand ownership to the runtime user.
RUN npm ci \
    && chown -R 1001:1001 /app

# Copy source code
COPY --chown=1001:1001 . .

USER 1001:1001

EXPOSE 3000

# Run Vite dev server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
