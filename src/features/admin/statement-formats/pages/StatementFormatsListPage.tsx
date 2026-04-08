import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Plus, Pencil, FileSpreadsheet } from 'lucide-react';
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
import { useStatementFormats } from '@/hooks/useStatementFormats';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePermission } from '@/features/auth/hooks/usePermission';

interface LocationState {
  message?: {
    type: 'success' | 'error' | 'warning';
    text: string;
  };
}

/**
 * Statement formats list and management page
 */
export function StatementFormatsListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: formats, isLoading, error } = useStatementFormats();
  const canWriteFormats = usePermission('statementformats:write');
  const [message, setMessage] = useState<LocationState['message'] | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sort formats: enabled first (alphabetically by bank name), then disabled
  const sortedFormats = useMemo(() => {
    if (!formats) return [];
    return [...formats].sort((a, b) => {
      // If one is enabled and the other is not, enabled comes first
      if (a.enabled !== b.enabled) {
        return a.enabled ? -1 : 1;
      }
      // Both have same enabled status, sort alphabetically by bank name
      return a.bankName.localeCompare(b.bankName);
    });
  }, [formats]);

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
                <FileSpreadsheet className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-4xl font-bold tracking-tight">Statement Formats</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Manage bank statement format configurations for imports
                </p>
              </div>
            </div>
          </div>
          {canWriteFormats && (
            <Link to="/admin/statement-formats/new">
              <Button className="gap-2 shadow-sm" size="lg">
                <Plus className="h-4 w-4" />
                Add Format
              </Button>
            </Link>
          )}
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
              Failed to load statement formats: {error.message}
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

        {/* Formats table */}
        {!isLoading && !error && formats && (
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="border-b bg-muted/50 hover:bg-muted/50">
                  <TableHead className="h-14 font-semibold">Format Key</TableHead>
                  <TableHead className="font-semibold">Bank Name</TableHead>
                  <TableHead className="font-semibold">Type</TableHead>
                  <TableHead className="font-semibold">Currency</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="text-right font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedFormats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FileSpreadsheet className="h-12 w-12 text-muted-foreground/40" />
                        <p className="text-sm font-medium text-muted-foreground">
                          No statement formats found
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Add your first format to get started
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedFormats.map((format) => (
                    <TableRow
                      key={format.formatKey}
                      className="group transition-colors hover:bg-muted/50"
                    >
                      <TableCell className="h-16 font-mono text-sm">{format.formatKey}</TableCell>
                      <TableCell className="font-semibold">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary">
                            {format.bankName.substring(0, 2).toUpperCase()}
                          </div>
                          <span className="text-base">{format.bankName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {format.formatType}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {format.defaultCurrencyIsoCode}
                      </TableCell>
                      <TableCell>
                        {format.enabled ? (
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
                      <TableCell className="text-right">
                        {canWriteFormats && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/admin/statement-formats/${format.formatKey}`)}
                            className="opacity-70 transition-opacity group-hover:opacity-100"
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="ml-2">Edit</span>
                          </Button>
                        )}
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
