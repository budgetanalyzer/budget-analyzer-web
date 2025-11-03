// src/components/ImportMessageBanner.tsx
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { fadeVariants, fadeTransition } from '@/lib/animations';

export interface ImportMessageBannerProps {
  type: 'success' | 'error' | 'warning';
  message: string;
  onClose: () => void;
}

export function ImportMessageBanner({ type, message, onClose }: ImportMessageBannerProps) {
  const colorClasses = {
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
    error: 'bg-destructive/15 text-destructive',
  };

  return (
    <motion.div
      key="import-message"
      variants={fadeVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={fadeTransition}
      className={`flex items-center justify-between rounded-lg px-4 py-3 ${colorClasses[type]}`}
    >
      <div className="flex items-center gap-2">
        {type === 'success' ? (
          <CheckCircle className="h-5 w-5" />
        ) : (
          <AlertCircle className="h-5 w-5" />
        )}
        <span className="font-medium">{message}</span>
      </div>
      <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
        <X className="h-4 w-4" />
      </Button>
    </motion.div>
  );
}
