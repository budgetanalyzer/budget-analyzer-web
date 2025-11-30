// src/features/transactions/components/BulkDeleteBar.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { slideUpVariants, slideUpTransition } from '@/lib/animations';

interface BulkDeleteBarProps {
  selectedCount: number;
  onDelete: () => void;
  onClearSelection: () => void;
  isVisible: boolean;
}

export function BulkDeleteBar({
  selectedCount,
  onDelete,
  onClearSelection,
  isVisible,
}: BulkDeleteBarProps) {
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
              <Button variant="destructive" size="sm" onClick={onDelete}>
                Delete
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
