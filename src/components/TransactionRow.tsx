// src/components/TransactionRow.tsx
import { TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Transaction } from '@/types/transaction';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';

interface TransactionRowProps {
  transaction: Transaction;
  index: number;
}

export function TransactionRow({ transaction, index }: TransactionRowProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/transactions/${transaction.id}`);
  };

  return (
    <motion.tr
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      onClick={handleClick}
      className="cursor-pointer hover:bg-muted/50 transition-colors"
    >
      <TableCell className="font-medium">{transaction.id}</TableCell>
      <TableCell>{formatDate(transaction.date)}</TableCell>
      <TableCell>{transaction.description}</TableCell>
      <TableCell>{transaction.bankName}</TableCell>
      <TableCell>{transaction.accountId}</TableCell>
      <TableCell>
        <Badge variant={transaction.type === 'CREDIT' ? 'success' : 'secondary'}>
          {transaction.type}
        </Badge>
      </TableCell>
      <TableCell
        className={`text-right font-semibold ${
          transaction.type === 'CREDIT' ? 'text-green-600 dark:text-green-400' : 'text-foreground'
        }`}
      >
        {formatCurrency(transaction.amount, transaction.currencyIsoCode)}
      </TableCell>
    </motion.tr>
  );
}
