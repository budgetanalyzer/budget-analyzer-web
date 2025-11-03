// src/components/TransactionStatsGrid.tsx
import { StatCard } from '@/components/StatCard';
import { LucideIcon } from 'lucide-react';

export interface StatCardConfig {
  title: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
  iconClassName?: string;
  valueClassName?: string;
}

export interface TransactionStatsGridProps {
  stats: StatCardConfig[];
  isLoading?: boolean;
}

export function TransactionStatsGrid({ stats, isLoading = false }: TransactionStatsGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <StatCard
          key={stat.title}
          title={stat.title}
          value={stat.value}
          description={stat.description}
          icon={stat.icon}
          iconClassName={stat.iconClassName}
          valueClassName={stat.valueClassName}
          isLoading={isLoading}
        />
      ))}
    </div>
  );
}
