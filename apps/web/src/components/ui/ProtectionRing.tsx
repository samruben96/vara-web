import { useId, useEffect, useState } from 'react';
import { cn } from '../../lib/cn';

/**
 * ProtectionRing — A circular ring component used across the Vara platform
 * to communicate protection status through calm, empowering visuals.
 *
 * Three display modes:
 * - `score`    — Progress ring with centered score number (0-100)
 * - `scanning` — Continuously rotating ring indicating active scan
 * - `minimal`  — Small static ring for compact contexts (cards, notifications)
 *
 * Uses an SVG gradient stroke from mint through blue-lavender to lavender,
 * consistent with Vara's calming color palette.
 */

export interface ProtectionRingProps {
  /** Display mode */
  variant: 'score' | 'scanning' | 'minimal';
  /** Protection score (0-100), used in 'score' variant */
  score?: number;
  /** Ring diameter in pixels */
  size?: number;
  /** Stroke width in pixels */
  strokeWidth?: number;
  /** Custom className */
  className?: string;
}

/** Default dimensions per variant */
const VARIANT_DEFAULTS: Record<
  ProtectionRingProps['variant'],
  { size: number; strokeWidth: number }
> = {
  score: { size: 200, strokeWidth: 10 },
  scanning: { size: 200, strokeWidth: 10 },
  minimal: { size: 48, strokeWidth: 4 },
};

/**
 * ProtectionRing component
 *
 * @example
 * ```tsx
 * // Score display — 92% protection
 * <ProtectionRing variant="score" score={92} />
 *
 * // Active scanning state
 * <ProtectionRing variant="scanning" />
 *
 * // Compact ring in a card
 * <ProtectionRing variant="minimal" size={32} />
 * ```
 */
export function ProtectionRing({
  variant,
  score = 0,
  size: sizeProp,
  strokeWidth: strokeWidthProp,
  className,
}: ProtectionRingProps): JSX.Element {
  const instanceId = useId();
  const gradientId = `vara-ring-gradient-${instanceId}`;
  const glowFilterId = `vara-ring-glow-${instanceId}`;

  const defaults = VARIANT_DEFAULTS[variant];
  const size = sizeProp ?? defaults.size;
  const strokeWidth = strokeWidthProp ?? defaults.strokeWidth;

  // Clamp score to 0-100
  const clampedScore = Math.max(0, Math.min(100, score));

  // SVG geometry
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // For score variant: animate dashoffset from fully hidden to the target value
  const targetOffset = circumference - (clampedScore / 100) * circumference;

  // Track whether the component has mounted so we can trigger the CSS transition
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Trigger on next frame so the initial dashoffset is painted first
    const frame = requestAnimationFrame(() => {
      setMounted(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const isScore = variant === 'score';
  const isScanning = variant === 'scanning';

  return (
    <>
      {/* Inline keyframes for the slow spin animation (8s vs Tailwind's 1s) */}
      {isScanning && (
        <style>{`
          @keyframes vara-ring-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes vara-ring-pulse {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 1; }
          }
        `}</style>
      )}

      <div
        className={cn(
          'relative inline-flex items-center justify-center',
          className,
        )}
        style={{ width: size, height: size }}
        role={isScore ? 'meter' : undefined}
        aria-valuenow={isScore ? clampedScore : undefined}
        aria-valuemin={isScore ? 0 : undefined}
        aria-valuemax={isScore ? 100 : undefined}
        aria-label={
          isScore
            ? `Protection score: ${clampedScore} out of 100`
            : isScanning
              ? 'Scanning in progress'
              : 'Protection status'
        }
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          fill="none"
          style={
            isScanning
              ? { animation: 'vara-ring-spin 8s linear infinite' }
              : undefined
          }
        >
          <defs>
            {/* Gradient: mint -> blue-lavender -> lavender */}
            <linearGradient
              id={gradientId}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="rgb(177, 239, 227)" />
              <stop offset="50%" stopColor="rgb(191, 172, 214)" />
              <stop offset="100%" stopColor="rgb(215, 202, 230)" />
            </linearGradient>

            {/* Subtle glow filter for score and scanning variants */}
            <filter id={glowFilterId} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background track (subtle, low opacity) */}
          {isScore && (
            <circle
              cx={center}
              cy={center}
              r={radius}
              stroke="currentColor"
              strokeWidth={strokeWidth}
              fill="none"
              className="text-foreground/5"
              strokeLinecap="round"
            />
          )}

          {/* Main gradient ring */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            filter={variant !== 'minimal' ? `url(#${glowFilterId})` : undefined}
            style={
              isScore
                ? {
                    strokeDasharray: circumference,
                    strokeDashoffset: mounted ? targetOffset : circumference,
                    transition: 'stroke-dashoffset 1s ease-out',
                    // Rotate so the arc starts from 12 o'clock
                    transform: `rotate(-90deg)`,
                    transformOrigin: `${center}px ${center}px`,
                  }
                : isScanning
                  ? {
                      animation: 'vara-ring-pulse 3s ease-in-out infinite',
                    }
                  : undefined
            }
          />
        </svg>

        {/* Center content for score variant */}
        {isScore && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="font-semibold leading-none text-foreground"
              style={{ fontSize: size * 0.28 }}
            >
              {clampedScore}
            </span>
            <span
              className="mt-1 text-foreground-muted"
              style={{ fontSize: Math.max(10, size * 0.07) }}
            >
              Protection Score
            </span>
          </div>
        )}
      </div>
    </>
  );
}

ProtectionRing.displayName = 'ProtectionRing';
