import { useCallback } from 'react';
import { Eye, EyeOff, FileSpreadsheet } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { usePermission } from '@/features/auth/hooks/usePermission';
import type { StatementFormat } from '@/types/statementFormat';

interface StatementFormatVisibilityTableProps {
  formats: StatementFormat[];
  pendingFormatId: number | null;
  onHide: (format: StatementFormat) => void;
  onUnhide: (format: StatementFormat) => void;
}

interface StatementFormatVisibilityRowProps {
  format: StatementFormat;
  canWriteFormats: boolean;
  isPending: boolean;
  onHide: (format: StatementFormat) => void;
  onUnhide: (format: StatementFormat) => void;
}

function getSourceLabel(format: StatementFormat) {
  return format.scope === 'USER' ? 'Custom' : 'System';
}

function StatementFormatVisibilityRow({
  format,
  canWriteFormats,
  isPending,
  onHide,
  onUnhide,
}: StatementFormatVisibilityRowProps) {
  const isHidden = Boolean(format.hidden);

  const handleHide = useCallback(() => {
    onHide(format);
  }, [format, onHide]);

  const handleUnhide = useCallback(() => {
    onUnhide(format);
  }, [format, onUnhide]);

  return (
    <TableRow className="transition-colors hover:bg-muted/50">
      <TableCell className="h-16 font-semibold">{format.displayName}</TableCell>
      <TableCell>{format.bankName}</TableCell>
      <TableCell>
        <Badge variant="outline" className="font-mono">
          {format.formatType}
        </Badge>
      </TableCell>
      <TableCell className="font-mono text-sm text-muted-foreground">
        {format.defaultCurrencyIsoCode}
      </TableCell>
      <TableCell>{getSourceLabel(format)}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-2">
          {isHidden ? (
            <Badge variant="secondary">Hidden</Badge>
          ) : (
            <Badge variant="success">Visible</Badge>
          )}
          {!format.enabled && <Badge variant="outline">Disabled</Badge>}
        </div>
      </TableCell>
      <TableCell className="text-right">
        {canWriteFormats &&
          (isHidden ? (
            <Button variant="outline" size="sm" onClick={handleUnhide} disabled={isPending}>
              <Eye className="mr-2 h-4 w-4" />
              {isPending ? 'Restoring...' : 'Restore to import'}
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleHide} disabled={isPending}>
              <EyeOff className="mr-2 h-4 w-4" />
              {isPending ? 'Hiding...' : 'Hide from import'}
            </Button>
          ))}
      </TableCell>
    </TableRow>
  );
}

export function StatementFormatVisibilityTable({
  formats,
  pendingFormatId,
  onHide,
  onUnhide,
}: StatementFormatVisibilityTableProps) {
  const canWriteFormats = usePermission('statementformats:write');

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <Table hideScrollbar={false}>
        <TableHeader>
          <TableRow className="border-b bg-muted/50 hover:bg-muted/50">
            <TableHead className="h-14 font-semibold">Display Name</TableHead>
            <TableHead className="font-semibold">Bank Name</TableHead>
            <TableHead className="font-semibold">Type</TableHead>
            <TableHead className="font-semibold">Currency</TableHead>
            <TableHead className="font-semibold">Source</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="text-right font-semibold">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {formats.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-32 text-center">
                <div className="flex flex-col items-center justify-center gap-2">
                  <FileSpreadsheet className="h-12 w-12 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-muted-foreground">
                    No statement formats found
                  </p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            formats.map((format) => (
              <StatementFormatVisibilityRow
                key={format.id}
                format={format}
                canWriteFormats={canWriteFormats}
                isPending={pendingFormatId === format.id}
                onHide={onHide}
                onUnhide={onUnhide}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
