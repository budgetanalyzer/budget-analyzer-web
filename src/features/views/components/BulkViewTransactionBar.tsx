import { motion, AnimatePresence } from 'framer-motion';
import { EyeOff, Pin } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { slideUpTransition, slideUpVariants } from '@/lib/animations';

interface BulkViewTransactionBarProps {
  selectedCount: number;
  isPinDisabled: boolean;
  isVisible: boolean;
  onClearSelection: () => void;
  onPin: () => void;
  onExclude: () => void;
}

export function BulkViewTransactionBar({
  selectedCount,
  isPinDisabled,
  isVisible,
  onClearSelection,
  onPin,
  onExclude,
}: BulkViewTransactionBarProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          variants={slideUpVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={slideUpTransition}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
        >
          <div className="flex items-center gap-4 rounded-lg border bg-background/95 px-6 py-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <span className="text-sm font-medium">
              {selectedCount} transaction{selectedCount !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClearSelection}>
                Clear selection
              </Button>
              <Button variant="outline" size="sm" onClick={onPin} disabled={isPinDisabled}>
                <Pin className="mr-2 h-4 w-4" />
                Pin
              </Button>
              <Button variant="destructive" size="sm" onClick={onExclude}>
                <EyeOff className="mr-2 h-4 w-4" />
                Exclude
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
