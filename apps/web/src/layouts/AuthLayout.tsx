import { Outlet, Link } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-center px-4 py-8">
        <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
          <img src="/vara-logo.png" alt="vara" className="h-10" />
        </Link>
      </header>

      {/* Main content */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer className="px-4 py-6 text-center">
        <p className="text-sm text-foreground-subtle">
          Your information is encrypted and never shared.
        </p>
      </footer>
    </div>
  );
}
