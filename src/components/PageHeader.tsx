// src/components/PageHeader.tsx
import { motion } from 'framer-motion';
import { fadeInVariants, fadeTransition } from '@/lib/animations';
import { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <motion.div
      variants={fadeInVariants}
      initial="initial"
      animate="animate"
      transition={fadeTransition}
      className="flex items-start justify-between"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
      {action}
    </motion.div>
  );
}
