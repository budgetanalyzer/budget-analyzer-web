// src/features/views/components/ViewCriteriaSummary.tsx
import { Badge } from '@/components/ui/Badge';
import { ViewCriteriaApi } from '@/types/view';
import { formatLocalDate } from '@/utils/dates';
import { Calendar, Search, DollarSign, Building2, EyeOff, Landmark, Coins } from 'lucide-react';

interface ViewCriteriaSummaryProps {
  criteria: ViewCriteriaApi;
  excludedCount: number;
  openEnded: boolean;
}

export function ViewCriteriaSummary({
  criteria,
  excludedCount,
  openEnded,
}: ViewCriteriaSummaryProps) {
  const badges: { icon: typeof Calendar; label: string; variant?: 'default' | 'secondary' }[] = [];

  // Date range
  if (criteria.startDate || criteria.endDate) {
    const startFormatted = criteria.startDate ? formatLocalDate(criteria.startDate) : 'Any';
    const endFormatted = criteria.endDate ? formatLocalDate(criteria.endDate) : 'Ongoing';
    badges.push({
      icon: Calendar,
      label: `${startFormatted} - ${endFormatted}`,
    });
  }

  // Search text
  if (criteria.searchText) {
    badges.push({
      icon: Search,
      label: `"${criteria.searchText}"`,
    });
  }

  // Amount range
  if (criteria.minAmount !== undefined || criteria.maxAmount !== undefined) {
    const min = criteria.minAmount !== undefined ? `$${criteria.minAmount}` : '$0';
    const max = criteria.maxAmount !== undefined ? `$${criteria.maxAmount}` : 'Any';
    badges.push({
      icon: DollarSign,
      label: `${min} - ${max}`,
    });
  }

  // Account IDs
  if (criteria.accountIds && criteria.accountIds.length > 0) {
    const accountLabel =
      criteria.accountIds.length === 1
        ? criteria.accountIds[0]
        : `${criteria.accountIds.length} accounts`;
    badges.push({
      icon: Building2,
      label: accountLabel,
    });
  }

  // Bank names
  if (criteria.bankNames && criteria.bankNames.length > 0) {
    const bankLabel =
      criteria.bankNames.length === 1
        ? criteria.bankNames[0]
        : `${criteria.bankNames.length} banks`;
    badges.push({
      icon: Landmark,
      label: bankLabel,
    });
  }

  // Currency codes
  if (criteria.currencyIsoCodes && criteria.currencyIsoCodes.length > 0) {
    const currencyLabel = criteria.currencyIsoCodes.join(', ');
    badges.push({
      icon: Coins,
      label: currencyLabel,
    });
  }

  // Excluded count
  if (excludedCount > 0) {
    badges.push({
      icon: EyeOff,
      label: `${excludedCount} excluded`,
      variant: 'secondary',
    });
  }

  if (badges.length === 0 && !openEnded) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">Criteria:</span>
      {badges.map((badge, index) => {
        const Icon = badge.icon;
        return (
          <Badge key={index} variant={badge.variant || 'default'} className="gap-1.5">
            <Icon className="h-3 w-3" />
            {badge.label}
          </Badge>
        );
      })}
      {openEnded && (
        <Badge variant="outline" className="gap-1.5 text-green-600 dark:text-green-400">
          Open-ended
        </Badge>
      )}
    </div>
  );
}
