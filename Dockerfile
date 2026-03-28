# Development Dockerfile - runs Vite dev server with HMR
FROM node:20-alpine@sha256:f598378b5240225e6beab68fa9f356db1fb8efe55173e6d4d8153113bb8f333c

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
