import { Link } from 'react-router';
import { motion } from 'motion/react';
import { ArrowRight, BarChart3, Bookmark, Hash } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { buildAnalyticsReturnUrl } from '@/features/analytics/utils/urlState';
import { fadeInVariants } from '@/lib/animations';
import type { SavedViewMetadata } from '@/types/view';
import { formatTimestamp } from '@/utils/dates';

interface ViewCardProps {
  view: SavedViewMetadata;
}

export function ViewCard({ view }: ViewCardProps) {
  const analyzeViewUrl = buildAnalyticsReturnUrl({
    scope: 'view',
    viewId: view.id,
    viewMode: 'monthly',
    transactionType: 'debit',
  });

  return (
    <motion.div variants={fadeInVariants}>
      <Card className="h-full transition-colors hover:border-primary/50 hover:bg-muted/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bookmark className="h-4 w-4 text-primary" />
            {view.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Hash className="h-3.5 w-3.5" />
              {view.transactionCount} transactions
            </span>
            <p>Updated {formatTimestamp(view.updatedAt)}</p>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Link
              to={analyzeViewUrl}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
              aria-label={`Analyze ${view.name}`}
            >
              <BarChart3 className="h-4 w-4" />
              Analyze
            </Link>
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
