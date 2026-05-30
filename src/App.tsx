// src/App.tsx
import { lazy, Suspense, type ReactNode } from 'react';
import { Routes, Route } from 'react-router';
import { Layout } from '@/components/Layout';
import { TransactionsPage } from '@/features/transactions/pages/TransactionsPage';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { SessionHeartbeatProvider } from '@/components/SessionHeartbeatProvider';
import { Toaster } from '@/components/ui/Toaster';

// Admin imports
import { AdminRoute } from '@/features/admin/components/AdminRoute';
import { AdminLayout } from '@/features/admin/components/AdminLayout';
import { UnauthorizedPage } from '@/features/admin/components/UnauthorizedPage';
import { PermissionGuard } from '@/features/auth/components/PermissionGuard';

// Auth imports
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { PeacePage } from '@/features/auth/pages/PeacePage';
import { ErrorPage } from '@/features/auth/pages/ErrorPage';

const TransactionDetailPage = lazy(() =>
  import('@/features/transactions/pages/TransactionDetailPage').then((module) => ({
    default: module.TransactionDetailPage,
  })),
);

const AnalyticsPage = lazy(() =>
  import('@/features/analytics/pages/AnalyticsPage').then((module) => ({
    default: module.AnalyticsPage,
  })),
);

const ViewsPage = lazy(() =>
  import('@/features/views/pages/ViewsPage').then((module) => ({
    default: module.ViewsPage,
  })),
);

const ViewPage = lazy(() =>
  import('@/features/views/pages/ViewPage').then((module) => ({
    default: module.ViewPage,
  })),
);

const AdminDashboard = lazy(() =>
  import('@/features/admin/pages/AdminDashboard').then((module) => ({
    default: module.AdminDashboard,
  })),
);

const AdminNotFoundPage = lazy(() =>
  import('@/features/admin/pages/AdminNotFoundPage').then((module) => ({
    default: module.AdminNotFoundPage,
  })),
);

const CurrenciesListPage = lazy(() =>
  import('@/features/admin/currencies/pages/CurrenciesListPage').then((module) => ({
    default: module.CurrenciesListPage,
  })),
);

const CurrencyCreatePage = lazy(() =>
  import('@/features/admin/currencies/pages/CurrencyCreatePage').then((module) => ({
    default: module.CurrencyCreatePage,
  })),
);

const CurrencyEditPage = lazy(() =>
  import('@/features/admin/currencies/pages/CurrencyEditPage').then((module) => ({
    default: module.CurrencyEditPage,
  })),
);

const StatementFormatsListPage = lazy(() =>
  import('@/features/admin/statement-formats/pages/StatementFormatsListPage').then((module) => ({
    default: module.StatementFormatsListPage,
  })),
);

const StatementFormatCreatePage = lazy(() =>
  import('@/features/admin/statement-formats/pages/StatementFormatCreatePage').then((module) => ({
    default: module.StatementFormatCreatePage,
  })),
);

const StatementFormatEditPage = lazy(() =>
  import('@/features/admin/statement-formats/pages/StatementFormatEditPage').then((module) => ({
    default: module.StatementFormatEditPage,
  })),
);

const AdminTransactionsPage = lazy(() =>
  import('@/features/admin/transactions/pages/AdminTransactionsPage').then((module) => ({
    default: module.AdminTransactionsPage,
  })),
);

const UsersListPage = lazy(() =>
  import('@/features/admin/users/pages/UsersListPage').then((module) => ({
    default: module.UsersListPage,
  })),
);

const UserDetailPage = lazy(() =>
  import('@/features/admin/users/pages/UserDetailPage').then((module) => ({
    default: module.UserDetailPage,
  })),
);

function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LoadingSpinner className="py-12" size="lg" />}>{children}</Suspense>;
}

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        {/* Admin — top-level, separate layout */}
        <Route path="/admin" element={<AdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route
              index
              element={
                <LazyRoute>
                  <AdminDashboard />
                </LazyRoute>
              }
            />
            <Route
              path="currencies"
              element={
                <PermissionGuard permission="currencies:read">
                  <LazyRoute>
                    <CurrenciesListPage />
                  </LazyRoute>
                </PermissionGuard>
              }
            />
            <Route
              path="currencies/new"
              element={
                <PermissionGuard permission="currencies:write">
                  <LazyRoute>
                    <CurrencyCreatePage />
                  </LazyRoute>
                </PermissionGuard>
              }
            />
            <Route
              path="currencies/:id"
              element={
                <PermissionGuard permission="currencies:write">
                  <LazyRoute>
                    <CurrencyEditPage />
                  </LazyRoute>
                </PermissionGuard>
              }
            />
            <Route
              path="statement-formats"
              element={
                <PermissionGuard permission="statementformats:read">
                  <LazyRoute>
                    <StatementFormatsListPage />
                  </LazyRoute>
                </PermissionGuard>
              }
            />
            <Route
              path="statement-formats/new"
              element={
                <PermissionGuard permission="statementformats:write">
                  <LazyRoute>
                    <StatementFormatCreatePage />
                  </LazyRoute>
                </PermissionGuard>
              }
            />
            <Route
              path="statement-formats/:id"
              element={
                <PermissionGuard permission="statementformats:write">
                  <LazyRoute>
                    <StatementFormatEditPage />
                  </LazyRoute>
                </PermissionGuard>
              }
            />
            <Route
              path="transactions"
              element={
                <PermissionGuard permission="transactions:read:any">
                  <LazyRoute>
                    <AdminTransactionsPage />
                  </LazyRoute>
                </PermissionGuard>
              }
            />
            <Route
              path="users"
              element={
                <PermissionGuard permission="users:read">
                  <LazyRoute>
                    <UsersListPage />
                  </LazyRoute>
                </PermissionGuard>
              }
            />
            <Route
              path="users/:id"
              element={
                <PermissionGuard permission="users:read">
                  <LazyRoute>
                    <UserDetailPage />
                  </LazyRoute>
                </PermissionGuard>
              }
            />
            <Route
              path="*"
              element={
                <LazyRoute>
                  <AdminNotFoundPage />
                </LazyRoute>
              }
            />
          </Route>
        </Route>

        {/* User — standard layout */}
        <Route path="/" element={<Layout />}>
          <Route index element={<TransactionsPage />} />
          <Route
            path="analytics"
            element={
              <LazyRoute>
                <AnalyticsPage />
              </LazyRoute>
            }
          />
          <Route
            path="transactions/:id"
            element={
              <LazyRoute>
                <TransactionDetailPage />
              </LazyRoute>
            }
          />
          <Route
            path="views"
            element={
              <LazyRoute>
                <ViewsPage />
              </LazyRoute>
            }
          />
          <Route
            path="views/:id"
            element={
              <LazyRoute>
                <ViewPage />
              </LazyRoute>
            }
          />
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
