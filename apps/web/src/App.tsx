import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useAuthSession } from './hooks/useAuthSession';
import { MainLayout } from './layouts/MainLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { Landing } from './pages/Landing';
import { Privacy } from './pages/Privacy';
import { Terms } from './pages/Terms';
import { Login } from './pages/auth/Login';
import { Signup } from './pages/auth/Signup';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { ResetPassword } from './pages/auth/ResetPassword';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import {
  OnboardingLayout,
  Welcome as OnboardingWelcome,
  Quiz as OnboardingQuiz,
  Results as OnboardingResults,
} from './pages/onboarding';

// Lazy-loaded page components for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ProtectedImages = lazy(() => import('./pages/ProtectedImages'));
const Alerts = lazy(() => import('./pages/Alerts'));
const ProtectionPlan = lazy(() => import('./pages/ProtectionPlan'));
const Settings = lazy(() => import('./pages/Settings'));
const Help = lazy(() => import('./pages/Help'));

// Loading fallback component with skeleton effect
function PageLoadingFallback() {
  return (
    <div className="flex min-h-[40vh] sm:min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3 sm:gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        <p className="text-sm text-neutral-500">Loading...</p>
      </div>
    </div>
  );
}

// Skeleton loading for content areas
export function ContentSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-48 rounded bg-neutral-200" />
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 sm:h-28 rounded-xl bg-neutral-200" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-neutral-200" />
    </div>
  );
}

export function App() {
  const { isAuthenticated } = useAuthStore();

  // Initialize auth session management - syncs Supabase session with Zustand store
  // and handles automatic token refresh
  useAuthSession();

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />

      {/* Auth routes */}
      <Route element={<AuthLayout />}>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />}
        />
        <Route
          path="/signup"
          element={<Signup />}
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Route>

      {/* Onboarding routes (protected) */}
      <Route element={<ProtectedRoute />}>
        <Route element={<OnboardingLayout />}>
          <Route path="/onboarding" element={<OnboardingWelcome />} />
          <Route path="/onboarding/quiz" element={<OnboardingQuiz />} />
          <Route path="/onboarding/results" element={<OnboardingResults />} />
        </Route>
      </Route>

      {/* Protected routes with lazy loading */}
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route
            path="/dashboard"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <Dashboard />
              </Suspense>
            }
          />
          <Route
            path="/images"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <ProtectedImages />
              </Suspense>
            }
          />
          <Route
            path="/alerts"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <Alerts />
              </Suspense>
            }
          />
          <Route
            path="/protection-plan"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <ProtectionPlan />
              </Suspense>
            }
          />
          <Route
            path="/settings"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <Settings />
              </Suspense>
            }
          />
          <Route
            path="/help"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <Help />
              </Suspense>
            }
          />
        </Route>
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
