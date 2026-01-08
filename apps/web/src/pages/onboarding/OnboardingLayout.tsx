import { Outlet, Link } from 'react-router-dom';
import { Shield } from 'lucide-react';

/**
 * Layout wrapper for onboarding flow
 * Provides a calming, centered design with brand elements
 */
export function OnboardingLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary-50/50 to-white">
      {/* Header with logo */}
      <header className="flex items-center justify-center px-4 py-6 sm:justify-start sm:px-8">
        <Link
          to="/"
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <Shield className="h-8 w-8 text-primary-600" />
          <span className="text-xl font-semibold text-neutral-900">Vara</span>
        </Link>
      </header>

      {/* Main content area */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-12">
        <div className="w-full max-w-lg">
          <Outlet />
        </div>
      </main>

      {/* Footer with reassurance */}
      <footer className="border-t border-neutral-200 bg-white/50 px-4 py-4">
        <div className="mx-auto max-w-lg text-center text-sm text-neutral-500">
          <p>
            Your responses are confidential and help us personalize your safety
            experience.
          </p>
        </div>
      </footer>
    </div>
  );
}
