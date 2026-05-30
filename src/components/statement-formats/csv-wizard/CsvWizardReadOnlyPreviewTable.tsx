import { Badge } from '@/components/ui/Badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import type { PreviewTransaction } from '@/types/transaction';

interface CsvWizardReadOnlyPreviewTableProps {
  transactions: PreviewTransaction[];
}

function formatAmount(amount: number, currencyIsoCode: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyIsoCode,
  }).format(amount);
}

export function CsvWizardReadOnlyPreviewTable({
  transactions,
}: CsvWizardReadOnlyPreviewTableProps) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        No transactions were parsed from the sample.
      </div>
    );
  }

  return (
    <Table className="min-w-[760px]" hideScrollbar={false}>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[110px]">Date</TableHead>
          <TableHead className="min-w-[220px]">Description</TableHead>
          <TableHead className="w-[100px]">Type</TableHead>
          <TableHead className="w-[120px] text-right">Amount</TableHead>
          <TableHead className="w-[100px]">Currency</TableHead>
          <TableHead className="w-[160px]">Account ID</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((transaction, index) => (
          <TableRow key={`${transaction.date}-${transaction.description}-${index}`}>
            <TableCell className="font-mono text-xs">{transaction.date}</TableCell>
            <TableCell>{transaction.description}</TableCell>
            <TableCell>
              <Badge variant={transaction.type === 'CREDIT' ? 'success' : 'secondary'}>
                {transaction.type}
              </Badge>
            </TableCell>
            <TableCell className="text-right font-mono">
              {formatAmount(transaction.amount, transaction.currencyIsoCode)}
            </TableCell>
            <TableCell>{transaction.currencyIsoCode}</TableCell>
            <TableCell>{transaction.accountId || 'None'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
