import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Home,
  Bell,
  Image,
  Shield,
  User,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useHaptics } from '@/hooks/mobile';

interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  { icon: Home, label: 'Home', path: '/dashboard' },
  { icon: Image, label: 'Images', path: '/images' },
  { icon: Bell, label: 'Alerts', path: '/alerts' },
  { icon: Shield, label: 'Plan', path: '/protection-plan' },
  { icon: User, label: 'Profile', path: '/settings' },
];

interface MobileBottomNavProps {
  alertCount?: number;
}

export function MobileBottomNav({ alertCount = 0 }: MobileBottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { triggerHaptic } = useHaptics();

  const handleNavClick = (path: string) => {
    triggerHaptic('light');
    navigate(path);
  };

  const isActive = (path: string) => {
    // Handle exact match for home
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/';
    }
    // Handle prefix match for other routes
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'border-t border-nav-border bg-nav/95 backdrop-blur-sm',
        'pb-safe md:hidden',
        'tap-highlight-none select-none-mobile'
      )}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-around h-16">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.path);
          const showBadge = item.path === '/alerts' && alertCount > 0;

          return (
            <button
              key={item.path}
              onClick={() => handleNavClick(item.path)}
              className={cn(
                'relative flex flex-col items-center justify-center',
                'w-full h-full min-h-touch',
                'touch-manipulation active-scale',
                'transition-colors duration-150'
              )}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              {/* Icon container with animation */}
              <motion.div
                animate={{
                  scale: active ? 1.1 : 1,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 400,
                  damping: 20,
                }}
                className="relative"
              >
                <item.icon
                  className={cn(
                    'h-6 w-6 transition-colors duration-150',
                    active ? 'text-nav-active' : 'text-nav-foreground'
                  )}
                  strokeWidth={active ? 2.5 : 2}
                />

                {/* Badge for alerts */}
                {showBadge && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={cn(
                      'absolute -top-1 -right-1.5',
                      'flex items-center justify-center',
                      'min-w-[16px] h-4 px-1',
                      'rounded-full bg-destructive',
                      'text-[10px] font-bold text-destructive-foreground'
                    )}
                  >
                    {alertCount > 99 ? '99+' : alertCount}
                  </motion.span>
                )}
              </motion.div>

              {/* Label */}
              <span
                className={cn(
                  'mt-1 text-[10px] font-medium transition-colors duration-150',
                  active ? 'text-nav-active' : 'text-nav-foreground'
                )}
              >
                {item.label}
              </span>

              {/* Active indicator dot */}
              {active && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute top-1 w-1 h-1 rounded-full bg-nav-active"
                  transition={{
                    type: 'spring',
                    stiffness: 400,
                    damping: 30,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileBottomNav;
