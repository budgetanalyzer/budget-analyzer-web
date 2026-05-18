import { useCallback, useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { SavedView } from '@/types/view';
import { AnalyticsScope } from '@/features/analytics/utils/urlState';
import { cn } from '@/utils/cn';

interface AnalyticsSourceSelectorProps {
  scope: AnalyticsScope;
  viewId?: string;
  selectedViewName?: string;
  views: SavedView[];
  isLoadingViews: boolean;
  hasViewsError: boolean;
  onChange: (source: { scope: AnalyticsScope; viewId?: string }) => void;
}

const ALL_SOURCE_VALUE = 'all';
const VIEW_SOURCE_PREFIX = 'view:';

function buildViewSourceValue(viewId: string): string {
  return `${VIEW_SOURCE_PREFIX}${viewId}`;
}

function getViewIdFromSourceValue(value: string): string | undefined {
  return value.startsWith(VIEW_SOURCE_PREFIX) ? value.slice(VIEW_SOURCE_PREFIX.length) : undefined;
}

export function AnalyticsSourceSelector({
  scope,
  viewId,
  selectedViewName,
  views,
  isLoadingViews,
  hasViewsError,
  onChange,
}: AnalyticsSourceSelectorProps) {
  const selectedValue =
    scope === 'view' && viewId ? buildViewSourceValue(viewId) : ALL_SOURCE_VALUE;

  const selectedLabel = useMemo(() => {
    if (scope === 'all') {
      return 'All transactions';
    }

    return selectedViewName ?? views.find((view) => view.id === viewId)?.name ?? 'Selected view';
  }, [scope, selectedViewName, viewId, views]);

  const handleValueChange = useCallback(
    (value: string) => {
      if (value === ALL_SOURCE_VALUE) {
        onChange({ scope: 'all' });
        return;
      }

      const nextViewId = getViewIdFromSourceValue(value);
      if (nextViewId) {
        onChange({ scope: 'view', viewId: nextViewId });
      }
    },
    [onChange],
  );

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor="analytics-source" className="text-xs font-medium text-muted-foreground">
        Source
      </label>
      <Select value={selectedValue} onValueChange={handleValueChange}>
        <SelectTrigger id="analytics-source" className="w-full min-w-48 max-w-72">
          <SelectValue>{selectedLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent className="min-w-56">
          <SelectItem value={ALL_SOURCE_VALUE}>All transactions</SelectItem>
          {views.map((view) => (
            <SelectItem key={view.id} value={buildViewSourceValue(view.id)}>
              {view.name}
            </SelectItem>
          ))}
          {(isLoadingViews || hasViewsError) && (
            <div
              className={cn(
                'px-2 py-1.5 text-sm',
                hasViewsError ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {hasViewsError ? 'Saved views unavailable' : 'Loading saved views...'}
            </div>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
