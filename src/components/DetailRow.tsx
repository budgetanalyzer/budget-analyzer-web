// src/components/DetailRow.tsx
import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

interface DetailRowProps {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  valueClassName?: string;
}

export function DetailRow({ icon: Icon, label, value, valueClassName }: DetailRowProps) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className={valueClassName || 'text-base'}>{value}</p>
      </div>
    </div>
  );
}
