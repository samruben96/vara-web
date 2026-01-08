import { motion } from 'framer-motion';
import { usePrefersReducedMotion } from '@/hooks/mobile';

interface PageTransitionProps {
  children: React.ReactNode;
  /** Animation variant */
  variant?: 'fade' | 'slide-up' | 'slide-right' | 'scale';
}

const variants = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  'slide-up': {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
  },
  'slide-right': {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.98 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.98 },
  },
};

const transition = {
  duration: 0.2,
  ease: [0.25, 0.1, 0.25, 1],
};

const reducedMotionVariants = {
  initial: { opacity: 1 },
  animate: { opacity: 1 },
  exit: { opacity: 1 },
};

export function PageTransition({
  children,
  variant = 'fade',
}: PageTransitionProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  const selectedVariants = prefersReducedMotion
    ? reducedMotionVariants
    : variants[variant];

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={selectedVariants}
      transition={transition}
    >
      {children}
    </motion.div>
  );
}

export default PageTransition;
