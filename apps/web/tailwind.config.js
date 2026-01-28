/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Add extra small breakpoint for very narrow phones
      screens: {
        xs: '475px',
      },
      colors: {
        /* ═══════════════════════════════════════════════════════════════════
           RAW COLOR PALETTE
           Direct access to the color scales for edge cases
           ═══════════════════════════════════════════════════════════════════ */

        // Cream - Background warmth
        cream: {
          50: 'rgb(var(--color-cream-50) / <alpha-value>)',
          100: 'rgb(var(--color-cream-100) / <alpha-value>)',
          200: 'rgb(var(--color-cream-200) / <alpha-value>)',
          300: 'rgb(var(--color-cream-300) / <alpha-value>)',
          400: 'rgb(var(--color-cream-400) / <alpha-value>)',
          500: 'rgb(var(--color-cream-500) / <alpha-value>)',
        },

        // Lavender - Calming accent
        lavender: {
          50: 'rgb(var(--color-lavender-50) / <alpha-value>)',
          100: 'rgb(var(--color-lavender-100) / <alpha-value>)',
          200: 'rgb(var(--color-lavender-200) / <alpha-value>)',
          300: 'rgb(var(--color-lavender-300) / <alpha-value>)',
          400: 'rgb(var(--color-lavender-400) / <alpha-value>)',
          500: 'rgb(var(--color-lavender-500) / <alpha-value>)',
          600: 'rgb(var(--color-lavender-600) / <alpha-value>)',
          700: 'rgb(var(--color-lavender-700) / <alpha-value>)',
          800: 'rgb(var(--color-lavender-800) / <alpha-value>)',
          900: 'rgb(var(--color-lavender-900) / <alpha-value>)',
        },

        // Mint - Safety & success
        mint: {
          50: 'rgb(var(--color-mint-50) / <alpha-value>)',
          100: 'rgb(var(--color-mint-100) / <alpha-value>)',
          200: 'rgb(var(--color-mint-200) / <alpha-value>)',
          300: 'rgb(var(--color-mint-300) / <alpha-value>)',
          400: 'rgb(var(--color-mint-400) / <alpha-value>)',
          500: 'rgb(var(--color-mint-500) / <alpha-value>)',
          600: 'rgb(var(--color-mint-600) / <alpha-value>)',
          700: 'rgb(var(--color-mint-700) / <alpha-value>)',
          800: 'rgb(var(--color-mint-800) / <alpha-value>)',
          900: 'rgb(var(--color-mint-900) / <alpha-value>)',
        },

        // Coral - Warm attention
        coral: {
          50: 'rgb(var(--color-coral-50) / <alpha-value>)',
          100: 'rgb(var(--color-coral-100) / <alpha-value>)',
          200: 'rgb(var(--color-coral-200) / <alpha-value>)',
          300: 'rgb(var(--color-coral-300) / <alpha-value>)',
          400: 'rgb(var(--color-coral-400) / <alpha-value>)',
          500: 'rgb(var(--color-coral-500) / <alpha-value>)',
          600: 'rgb(var(--color-coral-600) / <alpha-value>)',
          700: 'rgb(var(--color-coral-700) / <alpha-value>)',
          800: 'rgb(var(--color-coral-800) / <alpha-value>)',
          900: 'rgb(var(--color-coral-900) / <alpha-value>)',
        },

        // Charcoal - Text & dark mode
        charcoal: {
          50: 'rgb(var(--color-charcoal-50) / <alpha-value>)',
          100: 'rgb(var(--color-charcoal-100) / <alpha-value>)',
          200: 'rgb(var(--color-charcoal-200) / <alpha-value>)',
          300: 'rgb(var(--color-charcoal-300) / <alpha-value>)',
          400: 'rgb(var(--color-charcoal-400) / <alpha-value>)',
          500: 'rgb(var(--color-charcoal-500) / <alpha-value>)',
          600: 'rgb(var(--color-charcoal-600) / <alpha-value>)',
          700: 'rgb(var(--color-charcoal-700) / <alpha-value>)',
          800: 'rgb(var(--color-charcoal-800) / <alpha-value>)',
          900: 'rgb(var(--color-charcoal-900) / <alpha-value>)',
          950: 'rgb(var(--color-charcoal-950) / <alpha-value>)',
        },

        /* ═══════════════════════════════════════════════════════════════════
           SEMANTIC TOKENS (shadcn/ui compatible)
           These automatically switch between light and dark mode
           ═══════════════════════════════════════════════════════════════════ */

        // Background
        background: 'rgb(var(--background) / <alpha-value>)',
        'background-subtle': 'rgb(var(--background-subtle) / <alpha-value>)',
        'background-muted': 'rgb(var(--background-muted) / <alpha-value>)',
        'background-elevated': 'rgb(var(--background-elevated) / <alpha-value>)',

        // Foreground
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        'foreground-muted': 'rgb(var(--foreground-muted) / <alpha-value>)',
        'foreground-subtle': 'rgb(var(--foreground-subtle) / <alpha-value>)',

        // Primary
        primary: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          hover: 'rgb(var(--primary-hover) / <alpha-value>)',
          active: 'rgb(var(--primary-active) / <alpha-value>)',
          subtle: 'rgb(var(--primary-subtle) / <alpha-value>)',
          muted: 'rgb(var(--primary-muted) / <alpha-value>)',
          foreground: 'rgb(var(--primary-foreground) / <alpha-value>)',
        },

        // Secondary
        secondary: {
          DEFAULT: 'rgb(var(--secondary) / <alpha-value>)',
          hover: 'rgb(var(--secondary-hover) / <alpha-value>)',
          active: 'rgb(var(--secondary-active) / <alpha-value>)',
          subtle: 'rgb(var(--secondary-subtle) / <alpha-value>)',
          foreground: 'rgb(var(--secondary-foreground) / <alpha-value>)',
        },

        // Accent
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          hover: 'rgb(var(--accent-hover) / <alpha-value>)',
          subtle: 'rgb(var(--accent-subtle) / <alpha-value>)',
          foreground: 'rgb(var(--accent-foreground) / <alpha-value>)',
        },

        // Muted
        muted: {
          DEFAULT: 'rgb(var(--muted) / <alpha-value>)',
          hover: 'rgb(var(--muted-hover) / <alpha-value>)',
          foreground: 'rgb(var(--muted-foreground) / <alpha-value>)',
        },

        // Card
        card: {
          DEFAULT: 'rgb(var(--card) / <alpha-value>)',
          hover: 'rgb(var(--card-hover) / <alpha-value>)',
          foreground: 'rgb(var(--card-foreground) / <alpha-value>)',
        },

        // Popover
        popover: {
          DEFAULT: 'rgb(var(--popover) / <alpha-value>)',
          foreground: 'rgb(var(--popover-foreground) / <alpha-value>)',
        },

        // Border
        border: {
          DEFAULT: 'rgb(var(--border) / <alpha-value>)',
          subtle: 'rgb(var(--border-subtle) / <alpha-value>)',
          strong: 'rgb(var(--border-strong) / <alpha-value>)',
          focus: 'rgb(var(--border-focus) / <alpha-value>)',
        },

        // Ring
        ring: 'rgb(var(--ring) / <alpha-value>)',

        // Input
        input: {
          DEFAULT: 'rgb(var(--input) / <alpha-value>)',
          focus: 'rgb(var(--input-focus) / <alpha-value>)',
        },

        /* ═══════════════════════════════════════════════════════════════════
           STATUS COLORS
           ═══════════════════════════════════════════════════════════════════ */

        // Success
        success: {
          DEFAULT: 'rgb(var(--success) / <alpha-value>)',
          hover: 'rgb(var(--success-hover) / <alpha-value>)',
          subtle: 'rgb(var(--success-subtle) / <alpha-value>)',
          muted: 'rgb(var(--success-muted) / <alpha-value>)',
          foreground: 'rgb(var(--success-foreground) / <alpha-value>)',
          'foreground-subtle': 'rgb(var(--success-foreground-subtle) / <alpha-value>)',
        },

        // Warning
        warning: {
          DEFAULT: 'rgb(var(--warning) / <alpha-value>)',
          hover: 'rgb(var(--warning-hover) / <alpha-value>)',
          subtle: 'rgb(var(--warning-subtle) / <alpha-value>)',
          muted: 'rgb(var(--warning-muted) / <alpha-value>)',
          foreground: 'rgb(var(--warning-foreground) / <alpha-value>)',
          'foreground-subtle': 'rgb(var(--warning-foreground-subtle) / <alpha-value>)',
        },

        // Destructive (soft errors)
        destructive: {
          DEFAULT: 'rgb(var(--destructive) / <alpha-value>)',
          hover: 'rgb(var(--destructive-hover) / <alpha-value>)',
          subtle: 'rgb(var(--destructive-subtle) / <alpha-value>)',
          muted: 'rgb(var(--destructive-muted) / <alpha-value>)',
          foreground: 'rgb(var(--destructive-foreground) / <alpha-value>)',
          'foreground-subtle':
            'rgb(var(--destructive-foreground-subtle) / <alpha-value>)',
        },

        // Info
        info: {
          DEFAULT: 'rgb(var(--info) / <alpha-value>)',
          hover: 'rgb(var(--info-hover) / <alpha-value>)',
          subtle: 'rgb(var(--info-subtle) / <alpha-value>)',
          muted: 'rgb(var(--info-muted) / <alpha-value>)',
          foreground: 'rgb(var(--info-foreground) / <alpha-value>)',
          'foreground-subtle': 'rgb(var(--info-foreground-subtle) / <alpha-value>)',
        },

        /* ═══════════════════════════════════════════════════════════════════
           ALERT SEVERITY COLORS
           ═══════════════════════════════════════════════════════════════════ */

        alert: {
          info: {
            DEFAULT: 'rgb(var(--alert-info) / <alpha-value>)',
            bg: 'rgb(var(--alert-info-bg) / <alpha-value>)',
            border: 'rgb(var(--alert-info-border) / <alpha-value>)',
            text: 'rgb(var(--alert-info-text) / <alpha-value>)',
            icon: 'rgb(var(--alert-info-icon) / <alpha-value>)',
          },
          low: {
            DEFAULT: 'rgb(var(--alert-low) / <alpha-value>)',
            bg: 'rgb(var(--alert-low-bg) / <alpha-value>)',
            border: 'rgb(var(--alert-low-border) / <alpha-value>)',
            text: 'rgb(var(--alert-low-text) / <alpha-value>)',
            icon: 'rgb(var(--alert-low-icon) / <alpha-value>)',
          },
          medium: {
            DEFAULT: 'rgb(var(--alert-medium) / <alpha-value>)',
            bg: 'rgb(var(--alert-medium-bg) / <alpha-value>)',
            border: 'rgb(var(--alert-medium-border) / <alpha-value>)',
            text: 'rgb(var(--alert-medium-text) / <alpha-value>)',
            icon: 'rgb(var(--alert-medium-icon) / <alpha-value>)',
          },
          high: {
            DEFAULT: 'rgb(var(--alert-high) / <alpha-value>)',
            bg: 'rgb(var(--alert-high-bg) / <alpha-value>)',
            border: 'rgb(var(--alert-high-border) / <alpha-value>)',
            text: 'rgb(var(--alert-high-text) / <alpha-value>)',
            icon: 'rgb(var(--alert-high-icon) / <alpha-value>)',
          },
          critical: {
            DEFAULT: 'rgb(var(--alert-critical) / <alpha-value>)',
            bg: 'rgb(var(--alert-critical-bg) / <alpha-value>)',
            border: 'rgb(var(--alert-critical-border) / <alpha-value>)',
            text: 'rgb(var(--alert-critical-text) / <alpha-value>)',
            icon: 'rgb(var(--alert-critical-icon) / <alpha-value>)',
          },
        },

        /* ═══════════════════════════════════════════════════════════════════
           COMPONENT-SPECIFIC TOKENS
           ═══════════════════════════════════════════════════════════════════ */

        // Navigation
        nav: {
          DEFAULT: 'rgb(var(--nav-background) / <alpha-value>)',
          foreground: 'rgb(var(--nav-foreground) / <alpha-value>)',
          active: 'rgb(var(--nav-active) / <alpha-value>)',
          'active-bg': 'rgb(var(--nav-active-bg) / <alpha-value>)',
          hover: 'rgb(var(--nav-hover) / <alpha-value>)',
          'hover-bg': 'rgb(var(--nav-hover-bg) / <alpha-value>)',
          border: 'rgb(var(--nav-border) / <alpha-value>)',
        },

        // Sidebar
        sidebar: {
          DEFAULT: 'rgb(var(--sidebar-background) / <alpha-value>)',
          foreground: 'rgb(var(--sidebar-foreground) / <alpha-value>)',
          border: 'rgb(var(--sidebar-border) / <alpha-value>)',
        },

        // Charts
        chart: {
          1: 'rgb(var(--chart-1) / <alpha-value>)',
          2: 'rgb(var(--chart-2) / <alpha-value>)',
          3: 'rgb(var(--chart-3) / <alpha-value>)',
          4: 'rgb(var(--chart-4) / <alpha-value>)',
          5: 'rgb(var(--chart-5) / <alpha-value>)',
        },

        // Skeleton
        skeleton: {
          DEFAULT: 'rgb(var(--skeleton) / <alpha-value>)',
          shimmer: 'rgb(var(--skeleton-shimmer) / <alpha-value>)',
        },
      },

      /* ═══════════════════════════════════════════════════════════════════
         LEGACY COMPATIBILITY
         Keep the old neutral colors for any existing components
         ═══════════════════════════════════════════════════════════════════ */

      // Ring offset color
      ringOffsetColor: {
        DEFAULT: 'rgb(var(--ring-offset) / <alpha-value>)',
      },

      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
        serif: [
          '"DM Serif Display"',
          'Georgia',
          'Cambria',
          '"Times New Roman"',
          'serif',
        ],
      },

      borderRadius: {
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },

      // Safe area padding for notch/home indicator
      padding: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },

      // Minimum touch target height
      height: {
        touch: '44px',
        'touch-lg': '48px',
        'touch-xl': '56px',
      },

      minHeight: {
        touch: '44px',
        'touch-lg': '48px',
        'touch-xl': '56px',
      },

      // Bottom navigation bar height
      spacing: {
        'bottom-nav': '4rem',
        'bottom-nav-safe': 'calc(4rem + env(safe-area-inset-bottom))',
      },

      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.25s ease-out',
        'slide-in-left': 'slideInLeft 0.25s ease-out',
        'slide-in-bottom': 'slideInBottom 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        'scale-in': 'scaleIn 0.15s ease-out',
        'pulse-soft': 'pulseSoft 2s infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInBottom: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};
