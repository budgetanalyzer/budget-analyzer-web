// src/App.tsx
import { Routes, Route } from 'react-router';
import { Layout } from '@/components/Layout';
import { TransactionsPage } from '@/pages/TransactionsPage';
import { TransactionDetailPage } from '@/pages/TransactionDetailPage';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<TransactionsPage />} />
          <Route path="transactions/:id" element={<TransactionDetailPage />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}

export default App;