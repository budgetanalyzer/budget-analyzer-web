// src/components/MessageBanner.tsx
import { motion } from 'motion/react';
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
  const messageRole = type === 'error' ? 'alert' : 'status';

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
      <div role={messageRole} aria-atomic="true" className="flex items-center gap-2">
        {type === 'success' ? (
          <CheckCircle aria-hidden="true" className="h-5 w-5 flex-shrink-0" />
        ) : (
          <AlertCircle aria-hidden="true" className="h-5 w-5 flex-shrink-0" />
        )}
        <span className="font-medium whitespace-pre-line">{message}</span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="h-8 w-8"
        aria-label="Dismiss message"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </Button>
    </motion.div>
  );
}
