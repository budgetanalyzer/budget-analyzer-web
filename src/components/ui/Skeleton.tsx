// src/components/ui/Skeleton.tsx
import { cn } from '@/utils/cn';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('rounded bg-muted/40', className)} />;
}
