# Budget Analyzer Web

> "Archetype: interface. Role: React SPA; bridges users to the backend system."
>
> — [AGENTS.md](AGENTS.md#tree-position)

Modern React web application for Budget Analyzer - a reference architecture for microservices with a React frontend.

## Overview

Budget Analyzer Web is a full-featured React application that provides:

- **Transaction Management**: View, search, and filter financial transactions
- **Real-time Analytics**: Credits, debits, net balance, and spending insights
- **Multi-currency Support**: Handle transactions in different currencies
- **Responsive Design**: Mobile-first design with dark mode support
- **Advanced Table**: Sortable, filterable, and paginated transaction views
- **Secure Authentication**: OAuth2/OIDC via identity provider (IdP) with session-based security

## Technology Stack

- **React 19** with modern hooks and concurrent features
- **TypeScript** for type safety
- **Vite** for lightning-fast development and builds
- **React Router v7** for client-side routing
- **TanStack Query (React Query)** for async state management
- **Redux Toolkit** for UI state
- **TanStack Table** for advanced table features
- **Tailwind CSS** for styling
- **Shadcn/UI** for accessible components
- **Axios** for API communication
- **Vitest** for testing

## Quick Start

### Prerequisites

- Node.js 18+
- npm, yarn, or pnpm
- Docker and Docker Compose (backend infrastructure must be running)

**Backend infrastructure setup**: See [getting-started.md](https://github.com/budgetanalyzer/orchestration/blob/main/docs/development/getting-started.md)

### Installation

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Start development server
npm run dev
```

**IMPORTANT**: Access the app via `https://app.budgetanalyzer.localhost`, NOT directly via Vite (`http://localhost:3000`). Run `orchestration/nginx/scripts/dev/setup-local-https.sh` first to generate SSL certificates.

The checked-in Docker development runtime now drops root and runs Vite as UID/GID `1001`. Keep container-oriented changes compatible with `npm run dev -- --host 0.0.0.0 --port 3000` under that non-root user because Tilt relies on that path for the Kubernetes HMR workflow.

### Environment Configuration

Edit `.env` to configure your API endpoint:

```env
VITE_API_BASE_URL=/api
```

### Development vs Production URLs

**Development:**
- Access app: `https://app.budgetanalyzer.localhost` (Istio Ingress Gateway)
- Auth flow: Browser → Istio Ingress (443) → Session Gateway (8081)
- API calls: Browser → Istio Ingress (443) → ext_authz (9002) → NGINX (8080) → Backend services
- Frontend: Browser → Istio Ingress (443) → NGINX (8080) → Vite (3000)

**Production:**
- Access app: Load balancer domain (e.g., `https://budgetanalyzer.com`)
- Same Istio Ingress Gateway routing (Session Gateway for auth, ext_authz for API validation)

**Why Session Gateway?**
- Handles OAuth2 authentication with identity provider
- Manages session cookies (HttpOnly, Secure, SameSite)
- Stores Auth0 refresh tokens server-side in Redis (never exposed to browser)
- ext_authz validates sessions per-request via Redis lookup and injects identity headers

See [docs/authentication.md](docs/authentication.md) for complete authentication guide.

## Features

### Transaction List

- Summary cards with financial statistics
- Searchable and sortable transaction table
- Pagination controls
- Click rows to view details

### Dark Mode

Toggle between light and dark themes using the theme toggle. Preference is saved to localStorage.

### Error Handling

Comprehensive error handling with:
- Network error recovery
- User-friendly error messages
- Retry functionality
- Error boundaries for graceful degradation

## Development

### Available Scripts

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run preview   # Preview production build
npm run lint      # Run ESLint
npm run format    # Format with Prettier
npm test          # Run tests
npm run test:ui   # Run tests with UI
```

### Project Structure

```
src/
├── api/                    # API client and endpoints
├── components/            # Reusable components
│   ├── ui/               # Base UI components
│   └── ...               # Feature components
├── hooks/                # Custom React hooks
├── pages/                # Page components
├── store/                # Redux store
├── types/                # TypeScript types
└── lib/                  # Utilities
```

### Code Quality

- **ESLint** for code quality
- **Prettier** for formatting
- **TypeScript** for type safety
- **Vitest** for unit testing
- **React Testing Library** for component testing

## API Integration

### Connecting to Backend

Ensure backend infrastructure is running (see prerequisites above), then update `.env`:

```env
VITE_API_BASE_URL=/api
```

All API requests go through the NGINX gateway at `https://api.budgetanalyzer.localhost/api/*`

### Expected Endpoints

All endpoints accessed through gateway at `https://api.budgetanalyzer.localhost/api/*`:

- `GET /api/v1/transactions` - List all transactions
- `GET /api/v1/transactions/{id}` - Get single transaction
- `GET /api/v1/currencies` - List currencies
- `GET /api/v1/exchange-rates` - Get exchange rates

**API Documentation**: `https://api.budgetanalyzer.localhost/api/docs`

### Error Format

The app expects RFC 7807-inspired error responses:

```json
{
  "type": "not_found",
  "title": "Transaction Not Found",
  "status": 404,
  "detail": "Transaction with ID 123 could not be located",
  "instance": "/transactions/123",
  "timestamp": "2025-10-20T12:00:00Z"
}
```

## Architecture

### State Management

- **React Query**: Server state (API data, caching, loading states)
- **Redux Toolkit**: Client state (theme, UI preferences)

This separation provides optimal performance and developer experience.

### Component Strategy

Using Shadcn/UI for:
- Copy-paste components (no package bloat)
- Full customization control
- Tailwind CSS integration
- Built-in accessibility

### CSP Compliance

The production build is served with a strict Content Security Policy (`style-src 'self'` — no `unsafe-inline`). This means:

- **No inline `style={...}` props** — all styling uses Tailwind CSS classes
- **No runtime CSS injection** — libraries that call `document.createElement('style')` are banned
- **Custom toast system** — `sonner` was replaced with a Radix-based toast (`src/components/ui/Toast.tsx`) because sonner unconditionally injects `<style>` elements on import
- **Column widths** use a static Tailwind class map (`src/utils/columnWidth.ts`) instead of inline style props

This constraint ensures the CSP policy can be enforced without weakening it. See `AGENTS.md` for the full guardrail.

## Deployment

Build for production:

```bash
npm run build
```

The optimized files will be in `dist/`. Deploy to any static hosting:
- Vercel
- Netlify
- AWS S3 + CloudFront
- GitHub Pages

## Integration

This frontend integrates with the Budget Analyzer microservices:
- **[Session Gateway](https://github.com/budgetanalyzer/session-gateway)** — handles OAuth2 login, session management, stores Auth0 refresh tokens server-side in Redis (never exposed to browser)
- **ext_authz** (Istio Ingress) — per-request session validation via Redis lookup, injects identity headers
- **API Gateway** (NGINX) for request routing to backend services
- **Transaction Service** for transaction data
- **Currency Service** for currency and exchange rates
- **[Permission Service](https://github.com/budgetanalyzer/permission-service)** for user roles and permissions (resolved during login, stored in session hash)

See the [orchestration repository](https://github.com/budgetanalyzer/orchestration) for full system setup.

## Related Repositories

- **Orchestration**: https://github.com/budgetanalyzer/orchestration
- **Session Gateway**: https://github.com/budgetanalyzer/session-gateway
- **Permission Service**: https://github.com/budgetanalyzer/permission-service
- **Service Common**: https://github.com/budgetanalyzer/service-common
- **Transaction Service**: https://github.com/budgetanalyzer/transaction-service
- **Currency Service**: https://github.com/budgetanalyzer/currency-service

## License

MIT

## Contributing

This project is currently in early development. Contributions, issues, and feature requests are welcome as we build toward a stable release.
