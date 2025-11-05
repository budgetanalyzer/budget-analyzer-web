// src/App.tsx
import { Routes, Route } from 'react-router';
import { Layout } from '@/components/Layout';
import { TransactionsPage } from '@/pages/TransactionsPage';
import { TransactionDetailPage } from '@/pages/TransactionDetailPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Toaster } from 'sonner';

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<TransactionsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="transactions/:id" element={<TransactionDetailPage />} />
        </Route>
      </Routes>
      <Toaster richColors position="top-right" />
    </ErrorBoundary>
  );
}

export default App;
