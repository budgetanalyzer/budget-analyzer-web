// src/components/PageHeader.tsx
import { motion } from 'motion/react';
import { fadeInVariants, fadeTransition } from '@/lib/animations';
import { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  description: string;
  descriptionAction?: ReactNode;
  action?: ReactNode;
}

export function PageHeader({ title, description, descriptionAction, action }: PageHeaderProps) {
  return (
    <motion.div
      variants={fadeInVariants}
      initial="initial"
      animate="animate"
      transition={fadeTransition}
      className="flex items-start justify-between"
    >
      <div className="min-w-0">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-muted-foreground">{description}</p>
          {descriptionAction}
        </div>
      </div>
      {action}
    </motion.div>
  );
}
