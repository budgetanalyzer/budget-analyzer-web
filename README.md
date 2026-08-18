# Budget Analyzer Web

[![Build](https://github.com/budgetanalyzer/budget-analyzer-web/actions/workflows/build.yml/badge.svg)](https://github.com/budgetanalyzer/budget-analyzer-web/actions/workflows/build.yml)

React 19 single-page application for managing and analyzing financial
transactions. It provides the browser interface to the Budget Analyzer backend
and uses same-origin, server-side sessions.

## Features

- Transaction search, sorting, pagination, editing, deletion, and statement import
- Saved transaction views and multi-currency analytics
- Fine-grained user and administrator workflows
- Statement-format and currency management
- Responsive light and dark interfaces

## Quick Start

Install dependencies and create the local environment file:

```bash
npm install
cp .env.example .env
```

The supported application runtime is provided by the sibling
[orchestration repository](https://github.com/budgetanalyzer/orchestration/blob/main/docs/development/getting-started.md).
After that environment is healthy, open
`https://app.budgetanalyzer.localhost`; do not use the Vite port directly.

See the [development guide](docs/development.md) for prerequisites, commands,
environment variables, and build variants.

## Technology

React, TypeScript, Vite, React Router, TanStack Query, Redux Toolkit, TanStack
Table, Tailwind CSS, Axios, Vitest, Testing Library, MSW, and Playwright.

## Documentation

| Concern                                          | Owner                                                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Documentation index                              | [docs/README.md](docs/README.md)                                                                              |
| Setup, commands, environment, and builds         | [docs/development.md](docs/development.md)                                                                    |
| Structure, browser support, and CSP              | [docs/architecture.md](docs/architecture.md)                                                                  |
| Authentication, sessions, roles, and permissions | [docs/authentication.md](docs/authentication.md)                                                              |
| Frontend API behavior                            | [docs/api-integration.md](docs/api-integration.md)                                                            |
| Endpoint schemas and payloads                    | [Unified API](docs/api/budget-analyzer-api.yaml) and [Session Gateway API](docs/api/session-gateway-api.yaml) |
| State ownership                                  | [docs/state-architecture.md](docs/state-architecture.md)                                                      |
| Test policy, coverage, and Playwright            | [docs/testing-guide.md](docs/testing-guide.md)                                                                |
| React hooks, lifecycle, and effects              | [docs/react-hooks-lifecycle-mental-model.md](docs/react-hooks-lifecycle-mental-model.md)                      |

## Related Repositories

| Repository                                                                   | Role                                            |
| ---------------------------------------------------------------------------- | ----------------------------------------------- |
| [orchestration](https://github.com/budgetanalyzer/orchestration)             | Infrastructure, CI/CD, and system documentation |
| [session-gateway](https://github.com/budgetanalyzer/session-gateway)         | OAuth2 and session management                   |
| [permission-service](https://github.com/budgetanalyzer/permission-service)   | Roles and permissions                           |
| [transaction-service](https://github.com/budgetanalyzer/transaction-service) | Transaction and saved-view APIs                 |
| [currency-service](https://github.com/budgetanalyzer/currency-service)       | Currency and exchange-rate APIs                 |
| [service-common](https://github.com/budgetanalyzer/service-common)           | Shared backend libraries                        |

## License

MIT
