// src/components/IconLabel.tsx
import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

interface IconLabelProps {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  valueClassName?: string;
}

export function IconLabel({ icon: Icon, label, value, valueClassName }: IconLabelProps) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className={`break-words ${valueClassName || 'text-base'}`}>{value}</p>
      </div>
    </div>
  );
}
