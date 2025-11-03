// src/components/StatCard.tsx
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fadeInVariants, fadeTransition } from '@/lib/animations';

interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
  iconClassName?: string;
  valueClassName?: string;
  isLoading?: boolean;
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconClassName = 'text-muted-foreground',
  valueClassName = '',
  isLoading = false,
}: StatCardProps) {
  return (
    <motion.div
      variants={fadeInVariants}
      initial="initial"
      animate="animate"
      transition={fadeTransition}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className={cn('h-4 w-4', iconClassName)} />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-8 w-32" />
          ) : (
            <motion.div
              variants={fadeInVariants}
              initial="initial"
              animate="animate"
              transition={fadeTransition}
              className={cn('text-2xl font-bold', valueClassName)}
            >
              {value}
            </motion.div>
          )}
          <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
