import { Link } from 'react-router';
import { DollarSign, FileText, List, Plus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useCurrencies } from '@/hooks/useCurrencies';
import { useStatementFormats } from '@/hooks/useStatementFormats';
import { useAdminTransactions } from '@/features/admin/transactions/api/useAdminTransactions';

export function AdminDashboard() {
  const { user } = useAuth();
  const { data: currencies, isLoading: currenciesLoading } = useCurrencies();
  const { data: formats, isLoading: formatsLoading } = useStatementFormats();
  const { data: transactionsPage, isLoading: transactionsLoading } = useAdminTransactions({
    page: 0,
    size: 1,
    sort: ['date,DESC', 'id,DESC'],
  });

  const enabledCount = currencies?.filter((c) => c.enabled).length ?? 0;
  const totalCurrencies = currencies?.length ?? 0;
  const totalFormats = formats?.length ?? 0;
  const totalTransactions = transactionsPage?.metadata.totalElements ?? 0;

  return (
    <div className="h-full bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto px-8 py-10">
        {/* Welcome */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight">
            {user?.name ? `Welcome, ${user.name.split(' ')[0]}` : 'Admin Dashboard'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage currencies, statement formats, and system configuration.
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Currencies card */}
          <div className="rounded-xl border bg-card shadow-sm">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2.5">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="text-lg font-semibold">Currencies</h2>
                </div>
                {currenciesLoading ? (
                  <Skeleton className="h-8 w-12 rounded-md" />
                ) : (
                  <span className="text-2xl font-bold">{totalCurrencies}</span>
                )}
              </div>
              {!currenciesLoading && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {enabledCount} enabled, {totalCurrencies - enabledCount} disabled
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 border-t px-6 py-3">
              <Link to="/admin/currencies">
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                  View all
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
              <Link to="/admin/currencies/new">
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                  <Plus className="h-3.5 w-3.5" />
                  Add new
                </Button>
              </Link>
            </div>
          </div>

          {/* Statement Formats card */}
          <div className="rounded-xl border bg-card shadow-sm">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2.5">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="text-lg font-semibold">Statement Formats</h2>
                </div>
                {formatsLoading ? (
                  <Skeleton className="h-8 w-12 rounded-md" />
                ) : (
                  <span className="text-2xl font-bold">{totalFormats}</span>
                )}
              </div>
              {!formatsLoading && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {totalFormats} bank {totalFormats === 1 ? 'format' : 'formats'} configured
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 border-t px-6 py-3">
              <Link to="/admin/statement-formats">
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                  View all
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
              <Link to="/admin/statement-formats/new">
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                  <Plus className="h-3.5 w-3.5" />
                  Add new
                </Button>
              </Link>
            </div>
          </div>

          {/* Transactions card */}
          <div className="rounded-xl border bg-card shadow-sm">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2.5">
                    <List className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="text-lg font-semibold">Transactions</h2>
                </div>
                {transactionsLoading ? (
                  <Skeleton className="h-8 w-12 rounded-md" />
                ) : (
                  <span className="text-2xl font-bold">{totalTransactions.toLocaleString()}</span>
                )}
              </div>
              {!transactionsLoading && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Across all users (read-only view)
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 border-t px-6 py-3">
              <Link to="/admin/transactions">
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                  Browse all
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
