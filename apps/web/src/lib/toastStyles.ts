import type { ToastOptions } from 'react-hot-toast';

/**
 * Shared toast style presets for the Vara app.
 *
 * Uses CSS custom properties from our design tokens so toasts
 * respond correctly to light/dark mode and stay consistent
 * with the overall color system.
 *
 * Usage:
 *   import { toastPresets } from '@/lib/toastStyles';
 *   toast.success('Saved!', toastPresets.success);
 *   toast.error('Oops', toastPresets.error);
 *   toast('Heads up', toastPresets.warning);
 *   toast('FYI', toastPresets.info);
 */

export const toastPresets = {
  /** Green/mint -- positive confirmations */
  success: {
    style: {
      background: 'rgb(var(--success-subtle))',
      color: 'rgb(var(--success-foreground-subtle))',
      border: '1px solid rgb(var(--success-muted))',
    },
  } satisfies ToastOptions,

  /** Coral -- soft error / failure feedback */
  error: {
    style: {
      background: 'rgb(var(--destructive-subtle))',
      color: 'rgb(var(--destructive-foreground-subtle))',
      border: '1px solid rgb(var(--destructive-muted))',
    },
  } satisfies ToastOptions,

  /** Warm amber/coral -- attention without alarm */
  warning: {
    style: {
      background: 'rgb(var(--warning-subtle))',
      color: 'rgb(var(--warning-foreground-subtle))',
      border: '1px solid rgb(var(--warning-muted))',
    },
  } satisfies ToastOptions,

  /** Lavender -- neutral informational */
  info: {
    style: {
      background: 'rgb(var(--info-subtle))',
      color: 'rgb(var(--info-foreground-subtle))',
      border: '1px solid rgb(var(--info-muted))',
    },
  } satisfies ToastOptions,
} as const;
