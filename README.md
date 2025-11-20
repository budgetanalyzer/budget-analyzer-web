# Budget Analyzer Web

> **⚠️ Work in Progress**: This project is under active development. Features and documentation are subject to change.

Modern React web application for Budget Analyzer - a personal finance management tool for tracking transactions, analyzing spending patterns, and managing budgets.

## Overview

Budget Analyzer Web is a full-featured React application that provides:

- **Transaction Management**: View, search, and filter financial transactions
- **Real-time Analytics**: Credits, debits, net balance, and spending insights
- **Multi-currency Support**: Handle transactions in different currencies
- **Responsive Design**: Mobile-first design with dark mode support
- **Advanced Table**: Sortable, filterable, and paginated transaction views
- **Secure Authentication**: OAuth2/OIDC via Auth0 with session-based security

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

### Environment Configuration

Edit `.env` to configure your API endpoint:

```env
VITE_API_BASE_URL=/api
```

### Development vs Production URLs

**Development:**
- Access app: `https://app.budgetanalyzer.localhost` (NGINX → Session Gateway)
- Request flow: Browser → NGINX (443) → Session Gateway (8081) → NGINX → Vite (3000)
- API calls: Browser → NGINX (443) → Session Gateway (8081) → NGINX API (`api.budgetanalyzer.localhost`) → Backend services

**Production:**
- Access app: `https://budgetanalyzer.com` (Load Balancer)
- Request flow: Browser → Load Balancer → Session Gateway → NGINX → Static files
- API calls: Browser → Load Balancer → Session Gateway → NGINX → Backend services

**Why Session Gateway?**
- Handles OAuth2 authentication with Auth0
- Manages session cookies (HttpOnly, Secure, SameSite)
- Stores JWTs server-side in Redis (never exposed to browser)
- Automatically adds JWTs to API requests

See [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) for complete authentication guide.

## Features

### Mock Data Mode

By default, the app runs with mock data for:
- Testing UI without a backend
- Independent feature development
- Simulating API errors and edge cases

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
VITE_USE_MOCK_DATA=false
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
- **Transaction Service** for transaction data
- **Currency Service** for currency and exchange rates
- **API Gateway** (NGINX) for unified routing

See the [orchestration repository](https://github.com/budgetanalyzer/orchestration) for full system setup.

## Related Repositories

- **Orchestration**: https://github.com/budgetanalyzer/orchestration
- **Service Common**: https://github.com/budgetanalyzer/service-common
- **Transaction Service**: https://github.com/budgetanalyzer/transaction-service
- **Currency Service**: https://github.com/budgetanalyzer/currency-service

## License

MIT

## Contributing

This project is currently in early development. Contributions, issues, and feature requests are welcome as we build toward a stable release.
