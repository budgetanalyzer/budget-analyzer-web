// src/App.tsx
import { Routes, Route } from 'react-router';
import { Layout } from '@/components/Layout';
import { TransactionsPage } from '@/features/transactions/pages/TransactionsPage';
import { TransactionDetailPage } from '@/features/transactions/pages/TransactionDetailPage';
import { AnalyticsPage } from '@/features/analytics/pages/AnalyticsPage';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SessionHeartbeatProvider } from '@/components/SessionHeartbeatProvider';
import { Toaster } from '@/components/ui/Toaster';

// Admin imports
import { AdminRoute } from '@/features/admin/components/AdminRoute';
import { AdminLayout } from '@/features/admin/components/AdminLayout';
import { AdminDashboard } from '@/features/admin/pages/AdminDashboard';
import { AdminNotFoundPage } from '@/features/admin/pages/AdminNotFoundPage';
import { UnauthorizedPage } from '@/features/admin/components/UnauthorizedPage';
import { CurrenciesListPage } from '@/features/admin/currencies/pages/CurrenciesListPage';
import { CurrencyCreatePage } from '@/features/admin/currencies/pages/CurrencyCreatePage';
import { CurrencyEditPage } from '@/features/admin/currencies/pages/CurrencyEditPage';
import { StatementFormatsListPage } from '@/features/admin/statement-formats/pages/StatementFormatsListPage';
import { StatementFormatCreatePage } from '@/features/admin/statement-formats/pages/StatementFormatCreatePage';
import { StatementFormatEditPage } from '@/features/admin/statement-formats/pages/StatementFormatEditPage';
import { AdminTransactionsPage } from '@/features/admin/transactions/pages/AdminTransactionsPage';
import { UsersListPage } from '@/features/admin/users/pages/UsersListPage';
import { UserDetailPage } from '@/features/admin/users/pages/UserDetailPage';
import { PermissionGuard } from '@/features/auth/components/PermissionGuard';

// Views imports
import { ViewPage, ViewsPage } from '@/features/views';

// Auth imports
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { PeacePage } from '@/features/auth/pages/PeacePage';
import { ErrorPage } from '@/features/auth/pages/ErrorPage';

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        {/* Admin — top-level, separate layout */}
        <Route path="/admin" element={<AdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route
              path="currencies"
              element={
                <PermissionGuard permission="currencies:read">
                  <CurrenciesListPage />
                </PermissionGuard>
              }
            />
            <Route
              path="currencies/new"
              element={
                <PermissionGuard permission="currencies:write">
                  <CurrencyCreatePage />
                </PermissionGuard>
              }
            />
            <Route
              path="currencies/:id"
              element={
                <PermissionGuard permission="currencies:write">
                  <CurrencyEditPage />
                </PermissionGuard>
              }
            />
            <Route
              path="statement-formats"
              element={
                <PermissionGuard permission="statementformats:read">
                  <StatementFormatsListPage />
                </PermissionGuard>
              }
            />
            <Route
              path="statement-formats/new"
              element={
                <PermissionGuard permission="statementformats:write">
                  <StatementFormatCreatePage />
                </PermissionGuard>
              }
            />
            <Route
              path="statement-formats/:formatKey"
              element={
                <PermissionGuard permission="statementformats:write">
                  <StatementFormatEditPage />
                </PermissionGuard>
              }
            />
            <Route
              path="transactions"
              element={
                <PermissionGuard permission="transactions:read:any">
                  <AdminTransactionsPage />
                </PermissionGuard>
              }
            />
            <Route
              path="users"
              element={
                <PermissionGuard permission="users:read">
                  <UsersListPage />
                </PermissionGuard>
              }
            />
            <Route
              path="users/:id"
              element={
                <PermissionGuard permission="users:read">
                  <UserDetailPage />
                </PermissionGuard>
              }
            />
            <Route path="*" element={<AdminNotFoundPage />} />
          </Route>
        </Route>

        {/* User — standard layout */}
        <Route path="/" element={<Layout />}>
          <Route index element={<TransactionsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="transactions/:id" element={<TransactionDetailPage />} />
          <Route path="views" element={<ViewsPage />} />
          <Route path="views/:id" element={<ViewPage />} />
        </Route>

        {/* Auth routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/peace" element={<PeacePage />} />

        {/* Error routes */}
        <Route path="/oops" element={<ErrorPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
      </Routes>
      <SessionHeartbeatProvider />
      <Toaster />
    </ErrorBoundary>
  );
}

export default App;
