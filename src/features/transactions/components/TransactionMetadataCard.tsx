// src/features/transactions/components/TransactionMetadataCard.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { IconLabel } from '@/components/IconLabel';
import { Clock } from 'lucide-react';
import { formatTimestamp } from '@/utils/dates';

interface TransactionMetadataCardProps {
  createdAt: string;
  updatedAt: string;
}

export function TransactionMetadataCard({ createdAt, updatedAt }: TransactionMetadataCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Metadata</CardTitle>
        <CardDescription>System timestamps and tracking information</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <IconLabel icon={Clock} label="Created At" value={formatTimestamp(createdAt)} />
        <IconLabel icon={Clock} label="Last Updated" value={formatTimestamp(updatedAt)} />
      </CardContent>
    </Card>
  );
}
