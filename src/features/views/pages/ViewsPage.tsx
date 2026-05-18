import { motion } from 'framer-motion';
import { Bookmark } from 'lucide-react';
import { useViews } from '@/hooks/useViews';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorBanner } from '@/components/ErrorBanner';
import { fadeInVariants, layoutTransition } from '@/lib/animations';
import { ViewCard } from '@/features/views/components/ViewCard';

export function ViewsPage() {
  const { data: views, isLoading, error, refetch } = useViews();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" text="Loading views..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="w-full max-w-md">
          <ErrorBanner error={error} onRetry={() => refetch()} />
        </div>
      </div>
    );
  }

  const viewsList = Array.isArray(views) ? views : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Saved Views"
        description={`${viewsList.length} view${viewsList.length !== 1 ? 's' : ''}`}
      />

      {viewsList.length === 0 ? (
        <motion.div
          variants={fadeInVariants}
          initial="initial"
          animate="animate"
          transition={layoutTransition}
        >
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Bookmark className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="mb-2 text-lg font-medium">No saved views yet</h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                Create a view from the Transactions page by applying filters and clicking
                &ldquo;Save as View&rdquo;.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div
          variants={fadeInVariants}
          initial="initial"
          animate="animate"
          transition={layoutTransition}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {viewsList.map((view) => (
            <ViewCard key={view.id} view={view} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
