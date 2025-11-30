// src/components/MessageBanner.tsx
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { fadeVariants, fadeTransition } from '@/lib/animations';

export interface MessageBannerProps {
  type: 'success' | 'error' | 'warning';
  message: string;
  onClose: () => void;
}

/**
 * Generic reusable banner component for displaying messages
 * Can be used across the application for success, error, or warning messages
 */
export function MessageBanner({ type, message, onClose }: MessageBannerProps) {
  const colorClasses = {
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
    error: 'bg-destructive/15 text-destructive',
  };

  return (
    <motion.div
      key="message-banner"
      variants={fadeVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={fadeTransition}
      className={`flex items-center justify-between rounded-lg px-4 py-3 ${colorClasses[type]}`}
    >
      <div className="flex items-center gap-2">
        {type === 'success' ? (
          <CheckCircle className="h-5 w-5 flex-shrink-0" />
        ) : (
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
        )}
        <span className="font-medium whitespace-pre-line">{message}</span>
      </div>
      <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
        <X className="h-4 w-4" />
      </Button>
    </motion.div>
  );
}
