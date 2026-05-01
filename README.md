# Budget Analyzer Web

> "Archetype: interface. Role: React SPA; bridges users to the backend system."
>
> — [AGENTS.md](AGENTS.md#tree-position)

[![Build](https://github.com/budgetanalyzer/budget-analyzer-web/actions/workflows/build.yml/badge.svg)](https://github.com/budgetanalyzer/budget-analyzer-web/actions/workflows/build.yml)

React 19 SPA for managing and analyzing financial transactions. Session-based authentication via same-origin cookies — no JWTs in the browser.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

Access at `https://app.budgetanalyzer.localhost` (not `http://localhost:3000`).
Requires backend infrastructure — see [orchestration getting-started](https://github.com/budgetanalyzer/orchestration/blob/main/docs/development/getting-started.md).

## Features

- Transaction management — list, search, sort, paginate, import CSV
- Multi-currency support with exchange rates
- Real-time analytics — credits, debits, net balance
- Role-based access control with fine-grained permissions
- Dark mode with localStorage persistence
- Responsive mobile-first design

## Tech Stack

React 19 | TypeScript | Vite | React Router v7 | TanStack Query | Redux Toolkit | TanStack Table | Tailwind CSS | Shadcn/UI | Axios | Vitest

## Documentation

| Topic | Link |
|-------|------|
| Development setup, scripts, environment variables | [docs/development.md](docs/development.md) |
| API endpoints, error format, axios config | [docs/api-integration.md](docs/api-integration.md) |
| Architecture, state management, CSP, security model, permissions | [docs/architecture.md](docs/architecture.md) |
| Authentication flows, session heartbeat, troubleshooting | [docs/authentication.md](docs/authentication.md) |
| State architecture deep-dive | [docs/state-architecture.md](docs/state-architecture.md) |
| Testing patterns | [docs/testing-guide.md](docs/testing-guide.md) |

## Security Model (Summary)

- **Session cookies** (HttpOnly, Secure, SameSite=Strict) — no tokens in browser JS
- **Server-side sessions** in Redis — 15-minute sliding expiry
- **Per-request validation** — every API call validated before reaching backends
- **Instant revocation** — delete the Redis key, session is immediately dead
- **Strict CSP** — `style-src 'self'`, no inline styles or runtime CSS injection

See [docs/architecture.md](docs/architecture.md) for full details.

## Related Repositories

| Repository | Role |
|------------|------|
| [orchestration](https://github.com/budgetanalyzer/orchestration) | Infrastructure, CI/CD, system docs |
| [session-gateway](https://github.com/budgetanalyzer/session-gateway) | OAuth2 + session management |
| [permission-service](https://github.com/budgetanalyzer/permission-service) | Roles and permissions |
| [transaction-service](https://github.com/budgetanalyzer/transaction-service) | Transaction CRUD |
| [currency-service](https://github.com/budgetanalyzer/currency-service) | Currencies and exchange rates |
| [service-common](https://github.com/budgetanalyzer/service-common) | Shared Java libraries |

## License

MIT
