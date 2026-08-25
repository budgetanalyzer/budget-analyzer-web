import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { slideUpTransition, slideUpVariants } from '@/lib/animations';

interface RemoveViewTransactionsBarProps {
  selectedCount: number;
  isVisible: boolean;
  onClearSelection: () => void;
  onRemove: () => void;
}

export function RemoveViewTransactionsBar({
  selectedCount,
  isVisible,
  onClearSelection,
  onRemove,
}: RemoveViewTransactionsBarProps) {
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
              <Button variant="destructive" size="sm" onClick={onRemove}>
                <X className="mr-2 h-4 w-4" />
                Remove from view
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
