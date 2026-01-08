import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@vara/shared';
import { Button, Input } from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';

export function Login() {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();

  const from = (location.state as { from?: Location })?.from?.pathname || '/dashboard';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    setError(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      if (authData.user && authData.session) {
        login(
          {
            id: authData.user.id,
            email: authData.user.email!,
            emailVerified: !!authData.user.email_confirmed_at,
            profile: null, // Will be fetched separately
          },
          authData.session.access_token,
          authData.session.refresh_token,
          authData.session.expires_at
        );
        navigate(from, { replace: true });
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-neutral-900">Welcome back</h1>
      <p className="mt-2 text-neutral-600">
        Sign in to your account to continue protecting your digital presence.
      </p>

      {error && (
        <div className="mt-6 rounded-lg bg-alert-50 p-4 text-sm text-alert-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <div>
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            error={errors.password?.message}
            {...register('password')}
          />
          <div className="mt-2 text-right">
            <Link to="/forgot-password" className="text-sm text-primary-600 hover:text-primary-700">
              Forgot password?
            </Link>
          </div>
        </div>

        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          Sign in
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-neutral-600">
        Don't have an account?{' '}
        <Link to="/signup" className="font-medium text-primary-600 hover:text-primary-700">
          Sign up
        </Link>
      </p>
    </div>
  );
}
