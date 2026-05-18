import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { ArrowDownUp, ArrowRight, Bookmark, Calendar, EyeOff, Hash, Search } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { fadeInVariants } from '@/lib/animations';
import { SavedView } from '@/types/view';
import { formatLocalDate } from '@/utils/dates';

interface ViewCardProps {
  view: SavedView;
}

export function ViewCard({ view }: ViewCardProps) {
  const criteria = view.criteria;

  return (
    <motion.div variants={fadeInVariants}>
      <Card className="h-full transition-colors hover:border-primary/50 hover:bg-muted/50">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bookmark className="h-4 w-4 text-primary" />
              {view.name}
            </CardTitle>
            {view.openEnded && (
              <Badge
                variant="outline"
                className="shrink-0 text-xs text-green-600 dark:text-green-400"
              >
                Open-ended
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {(criteria.dateFrom || criteria.dateTo) && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Calendar className="h-3 w-3" />
                {criteria.dateFrom ? formatLocalDate(criteria.dateFrom) : 'Any'} -{' '}
                {criteria.dateTo ? formatLocalDate(criteria.dateTo) : 'Ongoing'}
              </Badge>
            )}
            {criteria.searchText && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Search className="h-3 w-3" />
                &ldquo;{criteria.searchText}&rdquo;
              </Badge>
            )}
            {criteria.type && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <ArrowDownUp className="h-3 w-3" />
                {criteria.type === 'DEBIT' ? 'Debit' : 'Credit'}
              </Badge>
            )}
            {criteria.accountIds && criteria.accountIds.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {criteria.accountIds.length} account{criteria.accountIds.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="flex items-center gap-1">
                <Hash className="h-3.5 w-3.5" />
                {view.transactionCount} transactions
              </span>
              {view.pinnedCount > 0 && (
                <span className="flex items-center gap-1 text-primary">
                  <Bookmark className="h-3.5 w-3.5 fill-current" />
                  {view.pinnedCount} pinned
                </span>
              )}
              {view.excludedCount > 0 && (
                <span className="flex items-center gap-1">
                  <EyeOff className="h-3.5 w-3.5" />
                  {view.excludedCount} excluded
                </span>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Link
              to={`/views/${view.id}`}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
              aria-label={`View details for ${view.name}`}
            >
              View Details
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
