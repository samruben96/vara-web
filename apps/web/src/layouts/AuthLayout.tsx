import { Outlet, Link } from 'react-router-dom';
import { Shield } from 'lucide-react';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen">
      {/* Left side - Branding */}
      <div className="hidden w-1/2 bg-gradient-to-br from-primary-600 to-primary-800 lg:block">
        <div className="flex h-full flex-col justify-between p-12">
          <Link to="/" className="flex items-center gap-3">
            <Shield className="h-10 w-10 text-white" />
            <span className="text-2xl font-semibold text-white">Vara</span>
          </Link>

          <div className="max-w-md">
            <h1 className="text-4xl font-bold leading-tight text-white">
              Your digital safety, simplified.
            </h1>
            <p className="mt-4 text-lg text-primary-100">
              Comprehensive protection from online harassment, stalking, and image misuse.
              Take control of your digital presence with confidence.
            </p>
          </div>

          <div className="text-sm text-primary-200">
            Trusted by thousands of women worldwide
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex w-full items-center justify-center px-4 lg:w-1/2">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-8 flex justify-center lg:hidden">
            <Link to="/" className="flex items-center gap-2">
              <Shield className="h-10 w-10 text-primary-600" />
              <span className="text-2xl font-semibold text-neutral-900">Vara</span>
            </Link>
          </div>

          <Outlet />
        </div>
      </div>
    </div>
  );
}
