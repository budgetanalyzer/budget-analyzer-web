# Development Dockerfile - runs Vite dev server with HMR
FROM node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5

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
