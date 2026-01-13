import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Sparkles, Heart } from 'lucide-react';

interface ProcessingAnimationProps {
  isVisible: boolean;
}

const PROCESSING_MESSAGES = [
  {
    text: 'Analyzing your responses...',
    icon: Sparkles,
  },
  {
    text: 'Understanding your unique needs...',
    icon: Heart,
  },
  {
    text: 'Creating your personalized safety plan...',
    icon: Shield,
  },
];

/**
 * Full-screen processing animation displayed while
 * the protection plan is being generated.
 *
 * Features calming, supportive messaging that cycles
 * through different stages of the process.
 */
export function ProcessingAnimation({ isVisible }: ProcessingAnimationProps) {
  const [messageIndex, setMessageIndex] = useState(0);

  // Cycle through messages every 1.5 seconds
  useEffect(() => {
    if (!isVisible) {
      setMessageIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % PROCESSING_MESSAGES.length);
    }, 1500);

    return () => clearInterval(interval);
  }, [isVisible]);

  // Safe access - messageIndex is always within bounds due to modulo operation
  const currentMessage = PROCESSING_MESSAGES[messageIndex]!;
  const Icon = currentMessage.icon;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm"
        >
          <div className="flex flex-col items-center px-6 text-center">
            {/* Animated icon container */}
            <motion.div
              className="relative mb-8"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              {/* Pulsing ring */}
              <motion.div
                className="absolute inset-0 rounded-full bg-primary-200"
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.6, 0.2, 0.6],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />

              {/* Second pulsing ring (offset) */}
              <motion.div
                className="absolute inset-0 rounded-full bg-primary-100"
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.4, 0, 0.4],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: 0.5,
                }}
              />

              {/* Icon container */}
              <motion.div
                className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary-100"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={messageIndex}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Icon className="h-10 w-10 text-primary-600" />
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            </motion.div>

            {/* Message text with animation */}
            <div className="h-16">
              <AnimatePresence mode="wait">
                <motion.p
                  key={messageIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="text-lg font-medium text-neutral-700"
                >
                  {currentMessage.text}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* Progress dots */}
            <div className="mt-4 flex gap-2">
              {PROCESSING_MESSAGES.map((_, index) => (
                <motion.div
                  key={index}
                  className={`h-2 w-2 rounded-full ${
                    index === messageIndex
                      ? 'bg-primary-600'
                      : 'bg-neutral-300'
                  }`}
                  animate={
                    index === messageIndex
                      ? { scale: [1, 1.2, 1] }
                      : { scale: 1 }
                  }
                  transition={{
                    duration: 0.6,
                    repeat: index === messageIndex ? Infinity : 0,
                  }}
                />
              ))}
            </div>

            {/* Reassuring subtext */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-8 text-sm text-neutral-500"
            >
              This only takes a moment
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
