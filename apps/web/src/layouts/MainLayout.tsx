import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Shield, Bell, User, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { cn } from '../lib/cn';
import { useIsMobile } from '../hooks/mobile';
import { MobileBottomNav, OfflineIndicator } from '../components/mobile';
import { useLockBodyScroll } from '../hooks/mobile/useLockBodyScroll';

export function MainLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  // Lock body scroll when mobile menu is open
  useLockBodyScroll(mobileMenuOpen);

  const handleLogout = () => {
    logout();
    navigate('/');
    setMobileMenuOpen(false);
  };

  const navItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Protected Images', href: '/images' },
    { label: 'Alerts', href: '/alerts' },
    { label: 'Protection Plan', href: '/protection-plan' },
    { label: 'Settings', href: '/settings' },
  ];

  // Mock alert count - in real app, this would come from a hook/store
  const alertCount = 3;

  return (
    <div className="min-h-screen-dynamic bg-neutral-50">
      {/* Offline Indicator */}
      <OfflineIndicator />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur-sm">
        <div className="container flex h-14 items-center justify-between md:h-16">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2 tap-highlight-none">
            <Shield className="h-7 w-7 text-primary-600 md:h-8 md:w-8" />
            <span className="text-lg font-semibold text-neutral-900 md:text-xl">Vara</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    'hover:bg-neutral-100 hover:text-neutral-900',
                    'min-h-touch flex items-center',
                    isActive
                      ? 'text-primary-600 bg-primary-50'
                      : 'text-neutral-600'
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1 md:gap-2">
            {/* Notifications - visible on all sizes */}
            <Link
              to="/alerts"
              className={cn(
                'relative rounded-lg p-2.5 text-neutral-600 transition-colors',
                'hover:bg-neutral-100 hover:text-neutral-900',
                'min-h-touch min-w-touch flex items-center justify-center',
                'tap-highlight-none active-scale'
              )}
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {alertCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-alert-500 px-1 text-[10px] font-bold text-white">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
            </Link>

            {/* Desktop-only user section */}
            <div className="hidden items-center gap-2 border-l border-neutral-200 pl-3 md:flex">
              <Link
                to="/settings"
                className={cn(
                  'flex items-center gap-2 rounded-lg p-2 text-neutral-600 transition-colors',
                  'hover:bg-neutral-100 hover:text-neutral-900',
                  'min-h-touch'
                )}
              >
                <User className="h-5 w-5" />
                <span className="text-sm font-medium max-w-[120px] truncate">
                  {user?.profile?.displayName || user?.email?.split('@')[0]}
                </span>
              </Link>
              <button
                onClick={handleLogout}
                className={cn(
                  'rounded-lg p-2 text-neutral-600 transition-colors',
                  'hover:bg-neutral-100 hover:text-neutral-900',
                  'min-h-touch min-w-touch flex items-center justify-center'
                )}
                aria-label="Log out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>

            {/* Mobile menu button - only show on tablet, hide on phone (we have bottom nav) */}
            <button
              className={cn(
                'rounded-lg p-2.5 text-neutral-600 transition-colors',
                'hover:bg-neutral-100',
                'min-h-touch min-w-touch flex items-center justify-center',
                'tap-highlight-none active-scale',
                'hidden sm:flex md:hidden'
              )}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile/Tablet Slide Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 top-14 z-40 bg-black/50 md:hidden"
                onClick={() => setMobileMenuOpen(false)}
              />

              {/* Menu Panel */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="absolute left-0 right-0 top-full z-50 border-t border-neutral-200 bg-white shadow-lg md:hidden"
              >
                <nav className="container py-2">
                  {navItems.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={cn(
                          'flex items-center rounded-lg px-4 py-3 text-base font-medium transition-colors',
                          'hover:bg-neutral-100',
                          'min-h-touch',
                          isActive
                            ? 'text-primary-600 bg-primary-50'
                            : 'text-neutral-700'
                        )}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {item.label}
                      </Link>
                    );
                  })}

                  {/* User info and logout in mobile menu */}
                  <div className="mt-2 border-t border-neutral-200 pt-2">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100">
                        <User className="h-5 w-5 text-primary-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-900 truncate">
                          {user?.profile?.displayName || 'User'}
                        </p>
                        <p className="text-xs text-neutral-500 truncate">
                          {user?.email}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleLogout}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-4 py-3',
                        'text-base font-medium text-neutral-700 transition-colors',
                        'hover:bg-neutral-100',
                        'min-h-touch'
                      )}
                    >
                      <LogOut className="h-5 w-5" />
                      Log out
                    </button>
                  </div>
                </nav>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content - add bottom padding for mobile bottom nav */}
      <main
        className={cn(
          'container py-4 sm:py-6 lg:py-8',
          // Add padding for bottom nav on mobile
          'pb-20 md:pb-6 lg:pb-8'
        )}
      >
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation - only on phone-sized screens */}
      {isMobile && <MobileBottomNav alertCount={alertCount} />}
    </div>
  );
}
