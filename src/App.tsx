// src/App.tsx
import { Routes, Route, Navigate } from 'react-router';
import { Layout } from '@/components/Layout';
import { TransactionsPage } from '@/features/transactions/pages/TransactionsPage';
import { TransactionDetailPage } from '@/features/transactions/pages/TransactionDetailPage';
import { AnalyticsPage } from '@/features/analytics/pages/AnalyticsPage';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Toaster } from 'sonner';

// Admin imports
import { UnauthorizedPage } from '@/features/admin/components/UnauthorizedPage';
import { CurrenciesListPage } from '@/features/admin/currencies/pages/CurrenciesListPage';
import { CurrencyCreatePage } from '@/features/admin/currencies/pages/CurrencyCreatePage';
import { CurrencyEditPage } from '@/features/admin/currencies/pages/CurrencyEditPage';

// Auth imports
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { PeacePage } from '@/features/auth/pages/PeacePage';

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        {/* Main app routes */}
        <Route path="/" element={<Layout />}>
          <Route index element={<TransactionsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="transactions/:id" element={<TransactionDetailPage />} />
          {/* Admin routes - using main layout until permissions are implemented */}
          <Route path="admin">
            <Route index element={<Navigate to="/admin/currencies" replace />} />
            <Route path="currencies" element={<CurrenciesListPage />} />
            <Route path="currencies/new" element={<CurrencyCreatePage />} />
            <Route path="currencies/:id" element={<CurrencyEditPage />} />
          </Route>
        </Route>

        {/* Auth routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/peace" element={<PeacePage />} />

        {/* Error routes */}
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
      </Routes>
      <Toaster richColors position="top-right" />
    </ErrorBoundary>
  );
}

export default App;
