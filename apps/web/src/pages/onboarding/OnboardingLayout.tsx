import { Outlet, Link } from 'react-router-dom';

/**
 * Layout wrapper for onboarding flow
 * Provides a calming, centered design with brand elements
 */
export function OnboardingLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-coral-100/60 via-background to-background">
      {/* Header with logo */}
      <header className="flex items-center justify-center px-4 py-6 sm:justify-start sm:px-8">
        <Link
          to="/"
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <img src="/vara-logo.png" alt="vara" className="h-10" />
        </Link>
      </header>

      {/* Main content area */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-12">
        <div className="w-full max-w-lg">
          <Outlet />
        </div>
      </main>

      {/* Footer with reassurance */}
      <footer className="border-t border-border/30 bg-background/80 px-4 py-4">
        <div className="mx-auto max-w-lg text-center text-sm text-foreground-muted">
          <p>
            Your responses are confidential and help us personalize your safety
            experience.
          </p>
        </div>
      </footer>
    </div>
  );
}
