import { useCallback } from 'react';

type HapticIntensity = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

interface HapticPatterns {
  light: number;
  medium: number;
  heavy: number;
  success: number[];
  warning: number[];
  error: number[];
}

const HAPTIC_PATTERNS: HapticPatterns = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [10, 50, 10],
  warning: [30, 50, 30],
  error: [50, 100, 50],
};

/**
 * Hook for triggering haptic feedback on supported devices
 */
export function useHaptics() {
  const isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;

  const triggerHaptic = useCallback((intensity: HapticIntensity = 'light') => {
    if (!isSupported) return false;

    try {
      const pattern = HAPTIC_PATTERNS[intensity];
      navigator.vibrate(pattern);
      return true;
    } catch {
      // Haptic feedback not available or denied
      return false;
    }
  }, [isSupported]);

  const cancelHaptic = useCallback(() => {
    if (!isSupported) return;
    try {
      navigator.vibrate(0);
    } catch {
      // Ignore errors
    }
  }, [isSupported]);

  return {
    isSupported,
    triggerHaptic,
    cancelHaptic,
  };
}

/**
 * Hook for button press haptic feedback
 */
export function useButtonHaptic() {
  const { triggerHaptic, isSupported } = useHaptics();

  const onPressStart = useCallback(() => {
    if (isSupported) {
      triggerHaptic('light');
    }
  }, [isSupported, triggerHaptic]);

  return { onPressStart };
}
