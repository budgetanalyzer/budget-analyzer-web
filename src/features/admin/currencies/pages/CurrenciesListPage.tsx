import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Plus, Pencil, Coins } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { MessageBanner } from '@/components/MessageBanner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { useCurrencies } from '@/hooks/useCurrencies';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatTimestamp } from '@/utils/dates';

interface LocationState {
  message?: {
    type: 'success' | 'error' | 'warning';
    text: string;
  };
}

/**
 * Currency list and management page
 */
export function CurrenciesListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: currencies, isLoading, error } = useCurrencies();
  const [message, setMessage] = useState<LocationState['message'] | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sort currencies: enabled first (alphabetically), then disabled (alphabetically)
  const sortedCurrencies = useMemo(() => {
    if (!currencies) return [];
    return [...currencies].sort((a, b) => {
      // If one is enabled and the other is not, enabled comes first
      if (a.enabled !== b.enabled) {
        return a.enabled ? -1 : 1;
      }
      // Both have same enabled status, sort alphabetically by currency code
      return a.currencyCode.localeCompare(b.currencyCode);
    });
  }, [currencies]);

  // Handle message from navigation state (e.g., after create/edit)
  useEffect(() => {
    const state = location.state as LocationState;
    if (state?.message) {
      setMessage(state.message);

      // Clear the navigation state to prevent showing the message again on refresh
      navigate(location.pathname, { replace: true, state: {} });

      // Auto-dismiss success messages after 5 seconds
      if (state.message.type === 'success') {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          setMessage(null);
        }, 5000);
      }
    }
  }, [location, navigate]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const clearMessage = useCallback(() => {
    setMessage(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return (
    <div className="h-full bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto px-8 py-10">
        {/* Header Section */}
        <div className="mb-10 flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-3">
                <Coins className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-4xl font-bold tracking-tight">Currencies</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Manage currency codes and exchange rate provider mappings
                </p>
              </div>
            </div>
          </div>
          <Link to="/admin/currencies/new">
            <Button className="gap-2 shadow-sm" size="lg">
              <Plus className="h-4 w-4" />
              Add Currency
            </Button>
          </Link>
        </div>

        {/* Success/Error Banner */}
        <AnimatePresence mode="wait">
          {message && (
            <div className="mb-6">
              <MessageBanner type={message.type} message={message.text} onClose={clearMessage} />
            </div>
          )}
        </AnimatePresence>

        {/* Error state */}
        {error && (
          <div className="rounded-xl border border-destructive bg-destructive/10 p-6 shadow-sm">
            <p className="text-center text-sm font-medium text-destructive">
              Failed to load currencies: {error.message}
            </p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        )}

        {/* Currency table */}
        {!isLoading && !error && currencies && (
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="border-b bg-muted/50 hover:bg-muted/50">
                  <TableHead className="h-14 font-semibold">Currency Code</TableHead>
                  <TableHead className="font-semibold">Provider Series ID</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Created</TableHead>
                  <TableHead className="font-semibold">Last Updated</TableHead>
                  <TableHead className="text-right font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCurrencies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Coins className="h-12 w-12 text-muted-foreground/40" />
                        <p className="text-sm font-medium text-muted-foreground">
                          No currencies found
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Add your first currency to get started
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedCurrencies.map((currency) => (
                    <TableRow
                      key={currency.id}
                      className="group transition-colors hover:bg-muted/50"
                    >
                      <TableCell className="h-16 font-semibold">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary">
                            {currency.currencyCode.substring(0, 2)}
                          </div>
                          <span className="text-base">{currency.currencyCode}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {currency.providerSeriesId}
                      </TableCell>
                      <TableCell>
                        {currency.enabled ? (
                          <Badge
                            variant="default"
                            className="rounded-full px-3 py-1 font-medium shadow-sm"
                          >
                            Enabled
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="rounded-full px-3 py-1 font-medium">
                            Disabled
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatTimestamp(currency.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatTimestamp(currency.updatedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/currencies/${currency.id}`)}
                          className="opacity-70 transition-opacity group-hover:opacity-100"
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="ml-2">Edit</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
