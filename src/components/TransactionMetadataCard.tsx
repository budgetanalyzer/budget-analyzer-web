// src/components/TransactionMetadataCard.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { DetailRow } from '@/components/DetailRow';
import { Clock } from 'lucide-react';
import { format } from 'date-fns';

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
        <DetailRow icon={Clock} label="Created At" value={format(new Date(createdAt), 'PPpp')} />
        <DetailRow icon={Clock} label="Last Updated" value={format(new Date(updatedAt), 'PPpp')} />
      </CardContent>
    </Card>
  );
}
