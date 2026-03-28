// src/App.tsx
import { Routes, Route, Navigate, Outlet } from 'react-router';
import { Layout } from '@/components/Layout';
import { TransactionsPage } from '@/features/transactions/pages/TransactionsPage';
import { TransactionDetailPage } from '@/features/transactions/pages/TransactionDetailPage';
import { AnalyticsPage } from '@/features/analytics/pages/AnalyticsPage';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Toaster } from '@/components/ui/Toaster';

// Admin imports
import { ProtectedRoute } from '@/features/admin/components/ProtectedRoute';
import { UnauthorizedPage } from '@/features/admin/components/UnauthorizedPage';
import { CurrenciesListPage } from '@/features/admin/currencies/pages/CurrenciesListPage';
import { CurrencyCreatePage } from '@/features/admin/currencies/pages/CurrencyCreatePage';
import { CurrencyEditPage } from '@/features/admin/currencies/pages/CurrencyEditPage';
import { StatementFormatsListPage } from '@/features/admin/statement-formats/pages/StatementFormatsListPage';
import { StatementFormatCreatePage } from '@/features/admin/statement-formats/pages/StatementFormatCreatePage';
import { StatementFormatEditPage } from '@/features/admin/statement-formats/pages/StatementFormatEditPage';

// Views imports
import { ViewPage, ViewsPage } from '@/features/views';

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
          <Route path="views" element={<ViewsPage />} />
          <Route path="views/:id" element={<ViewPage />} />
          {/* Admin routes - role-gated to ADMIN users */}
          <Route
            path="admin"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <Outlet />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/currencies" replace />} />
            <Route path="currencies" element={<CurrenciesListPage />} />
            <Route path="currencies/new" element={<CurrencyCreatePage />} />
            <Route path="currencies/:id" element={<CurrencyEditPage />} />
            <Route path="statement-formats" element={<StatementFormatsListPage />} />
            <Route path="statement-formats/new" element={<StatementFormatCreatePage />} />
            <Route path="statement-formats/:formatKey" element={<StatementFormatEditPage />} />
          </Route>
        </Route>

        {/* Auth routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/peace" element={<PeacePage />} />

        {/* Error routes */}
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
      </Routes>
      <Toaster />
    </ErrorBoundary>
  );
}

export default App;
