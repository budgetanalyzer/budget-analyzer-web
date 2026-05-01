# Development Guide

## Prerequisites

- Node.js 18+
- npm, yarn, or pnpm
- Docker and Docker Compose (backend infrastructure must be running)

**Backend infrastructure setup**: See [getting-started.md](https://github.com/budgetanalyzer/orchestration/blob/main/docs/development/getting-started.md)

## Installation

```bash
npm install
cp .env.example .env
npm run dev
```

**IMPORTANT**: Access the app via `https://app.budgetanalyzer.localhost`, NOT directly via Vite (`http://localhost:3000`). Run `../orchestration/scripts/bootstrap/setup-k8s-tls.sh` on the host first to generate SSL certificates.

## Docker Runtime

The Docker development runtime runs Vite as UID/GID `1001` (non-root). Keep container-oriented changes compatible with `npm run dev -- --host 0.0.0.0 --port 3000` under that user because Tilt relies on that path for the Kubernetes HMR workflow.

## Available Scripts

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run preview   # Preview production build
npm run lint      # Run ESLint
npm run format    # Format with Prettier
npm test          # Run tests
npm run test:ui   # Run tests with UI
```

## Environment Variables

Edit `.env` to configure your environment:

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `/api` | Base path for all API calls |
| `VITE_HEARTBEAT_INTERVAL_MS` | `120000` (2 min) | Interval between session heartbeat calls |
| `VITE_WARNING_BEFORE_EXPIRY_SECONDS` | `120` (2 min) | Show inactivity warning this many seconds before session expiry |

## Project Structure

```
src/
├── api/                    # API client and endpoints
├── components/            # Reusable components
│   ├── ui/               # Base UI components (Shadcn)
│   └── ...               # Feature components
├── features/             # Feature modules (auth, admin, etc.)
├── hooks/                # Custom React hooks
├── pages/                # Page components
├── store/                # Redux store
├── types/                # TypeScript types
└── lib/                  # Utilities
```

## Code Quality

- **ESLint** for code quality
- **Prettier** for formatting
- **TypeScript** for type safety
- **Vitest** for unit testing
- **React Testing Library** for component testing

## Development vs Production URLs

**Development:**
- Access: `https://app.budgetanalyzer.localhost`
- Auth/API traffic routes through the same origin — Session Gateway handles auth, NGINX routes API calls to backend services

**Production:**
- Access: Load balancer domain (e.g., `https://budgetanalyzer.com`)
- Same routing architecture via gateway

## Build & Deployment

### Production Build

```bash
npm run build         # Standard production build (served at /)
npm run build:prod-smoke  # Prod-smoke verification build (served at /_prod-smoke/)
```

Output lands in `dist/`. NGINX serves these files in production.

The `build:prod-smoke` build is used by orchestration to verify production CSP and browser security on the live origin. Auth and API paths remain root-relative regardless of which build is used.

### Container Releases

The local `Dockerfile` powers the Vite/HMR path used by Tilt. Release image publishing (GHCR, tag and dispatch contract) is owned by orchestration — see [CI/CD Workflows](https://github.com/budgetanalyzer/orchestration/blob/main/docs/ci-cd.md).

### Static Hosting

The `dist/` output can be deployed to any static hosting: Vercel, Netlify, AWS S3 + CloudFront, GitHub Pages.
