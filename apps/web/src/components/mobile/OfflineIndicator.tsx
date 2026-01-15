import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff } from 'lucide-react';
import { useIsOnline } from '@/hooks/mobile';

export function OfflineIndicator() {
  const isOnline = useIsOnline();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 30,
          }}
          className="fixed top-0 left-0 right-0 z-[60] pt-safe"
        >
          <div className="bg-charcoal-800 text-charcoal-50 py-2 px-4 flex items-center justify-center gap-2 text-sm">
            <WifiOff className="h-4 w-4 flex-shrink-0" />
            <span>You're offline. Some features may be limited.</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default OfflineIndicator;
