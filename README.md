# README.md

# Budget Analyzer Client

A modern, fully-featured React application for managing and analyzing financial transactions. Built with React 19, TypeScript, and Vite, this application demonstrates best practices for modern frontend development.

## 🚀 Features

- **Transaction Management**: View, search, and filter financial transactions
- **Detailed Analytics**: Real-time statistics including credits, debits, and net balance
- **Advanced Table**: Sortable, filterable, and paginated transaction table using TanStack Table
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **Dark Mode**: Toggle between light and dark themes
- **Error Handling**: Comprehensive error handling with retry functionality
- **Type Safety**: Full TypeScript support with generated types from OpenAPI spec
- **Modern Architecture**: Clean separation of concerns with hooks, components, and API layers

## 📋 Tech Stack

- **React 19** - Latest React with modern hooks and concurrent features
- **TypeScript** - Type-safe development
- **Vite** - Lightning-fast build tool
- **React Router v7** - Client-side routing
- **TanStack Query (React Query)** - Async state management and caching
- **Redux Toolkit** - Global UI state management
- **TanStack Table** - Headless table library
- **Tailwind CSS** - Utility-first CSS framework
- **Shadcn/UI** - Beautiful, accessible component library
- **Framer Motion** - Smooth animations
- **Axios** - HTTP client with interceptors
- **Vitest** - Fast unit testing
- **date-fns** - Modern date utility library

## 🛠️ Installation

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm

### Setup

1. **Clone or create the project directory:**
```bash
mkdir budget-analyzer-web
cd budget-analyzer-web
```

2. **Copy all the generated files to the project directory**

3. **Install dependencies:**
```bash
npm install
```

4. **Configure environment variables:**

Copy the `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env` to configure your API endpoint:
```env
VITE_API_BASE_URL=http://localhost:8080/budget-analyzer-api
VITE_USE_MOCK_DATA=true
```

**Note:** Set `VITE_USE_MOCK_DATA=false` when connecting to a real backend.

5. **Start the development server:**
```bash
npm run dev
```

The application will open at `http://localhost:3000`

## 📁 Project Structure
```
src/
├── api/                    # API client and endpoints
│   ├── client.ts          # Axios instance with interceptors
│   ├── transactionApi.ts  # Transaction API methods
│   └── mockData.ts        # Mock data for development
├── components/            # Reusable components
│   ├── ui/               # Base UI components (Button, Card, etc.)
│   ├── ErrorBanner.tsx   # Error display component
│   ├── ErrorBoundary.tsx # Error boundary wrapper
│   ├── Layout.tsx        # Main layout component
│   ├── LoadingSpinner.tsx # Loading indicator
│   ├── ThemeToggle.tsx   # Dark mode toggle
│   ├── TransactionRow.tsx # Table row component
│   └── TransactionTable.tsx # Main table component
├── hooks/                 # Custom React hooks
│   └── useTransactions.ts # Transaction data hook
├── lib/                   # Utility functions
│   └── utils.ts          # Helper functions
├── pages/                 # Page components
│   ├── TransactionsPage.tsx       # Main transactions list
│   └── TransactionDetailPage.tsx  # Transaction details
├── store/                 # Redux store
│   ├── index.ts          # Store configuration
│   ├── uiSlice.ts        # UI state slice
│   └── hooks.ts          # Typed Redux hooks
├── test/                  # Test files
│   ├── setup.ts          # Test configuration
│   ├── Button.test.tsx   # Component tests
│   └── useTransactions.test.tsx # Hook tests
├── types/                 # TypeScript types
│   ├── transaction.ts    # Transaction types
│   └── apiError.ts       # API error types
├── App.tsx               # Main app component
├── main.tsx              # Application entry point
└── index.css             # Global styles
```

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm test` - Run tests
- `npm run test:ui` - Run tests with UI

## 🎨 Features Walkthrough

### Mock Data Mode

By default, the app runs with mock data. This allows you to:
- Test the UI without a backend
- Develop and demo features independently
- Simulate API errors and edge cases

To enable real API calls, set `VITE_USE_MOCK_DATA=false` in your `.env` file.

### Transaction List

The main page displays:
- Summary cards with total transactions, credits, debits, and net balance
- Searchable and sortable transaction table
- Pagination controls
- Click any row to view details

### Transaction Details

Click any transaction to see:
- Full transaction information
- Account and bank details
- System metadata (created/updated timestamps)

### Error Handling

The app gracefully handles:
- Network errors (503 Service Unavailable)
- Not found errors (404)
- Server errors (500)
- All errors display user-friendly messages with retry options

### Dark Mode

Toggle dark mode using the sun/moon icon in the header. The preference is saved to localStorage.

## 🔌 API Integration

### Connecting to Your Backend

1. Update `.env`:
```env
VITE_API_BASE_URL=https://api.bleurubin.com
VITE_USE_MOCK_DATA=false
```

2. Ensure your backend implements the OpenAPI spec endpoints:
   - `GET /transactions` - List all transactions
   - `GET /transactions/{id}` - Get single transaction

### API Error Format

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

## 🧪 Testing

Run tests with:
```bash
npm test
```

The project includes:
- Component tests using React Testing Library
- Hook tests with React Query
- Vitest configuration for fast test execution

## 🏗️ Architecture Decisions

### React Query vs Redux

- **React Query**: Used for server state (API data, caching, loading states)
- **Redux Toolkit**: Used for client state (theme, UI preferences, selected items)

This separation provides optimal performance and developer experience.

### Why Vite?

Vite offers:
- Instant server start
- Lightning-fast HMR
- Optimized builds
- Native ESM support

### Component Library Strategy

Using Shadcn/UI provides:
- Copy-paste components (no package bloat)
- Full customization control
- Tailwind CSS integration
- Accessibility built-in

## 🚀 Deployment

Build for production:
```bash
npm run build
```

The optimized files will be in the `dist/` directory. Deploy to:
- Vercel
- Netlify
- AWS S3 + CloudFront
- Any static hosting service

## 📝 License

MIT

## 👤 Author

Bleu Rubin - support@bleurubin.com

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!