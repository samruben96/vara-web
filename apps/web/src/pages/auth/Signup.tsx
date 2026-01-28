import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { signupSchema, type SignupInput } from '@vara/shared';
import { Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

export function Signup() {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupInput) => {
    setError(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          // Email verification link will redirect to dashboard
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      if (authData.user && authData.session) {
        // Session available - log in and go to onboarding
        login(
          {
            id: authData.user.id,
            email: authData.user.email!,
            emailVerified: !!authData.user.email_confirmed_at,
            profile: null,
          },
          authData.session.access_token,
          authData.session.refresh_token,
          authData.session.expires_at
        );
        toast.success('Welcome to Vara!', {
          duration: 2500,
          className: 'bg-success-subtle text-success-foreground-subtle border border-success-muted',
        });
        navigate('/onboarding', { replace: true });
      } else if (authData.user && !authData.session) {
        // No session - email confirmation might be required
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });

        if (signInError) {
          setError('Account created! Please disable "Confirm email" in Supabase Auth settings, or verify your email first.');
          return;
        }

        if (signInData.user && signInData.session) {
          login(
            {
              id: signInData.user.id,
              email: signInData.user.email!,
              emailVerified: !!signInData.user.email_confirmed_at,
              profile: null,
            },
            signInData.session.access_token,
            signInData.session.refresh_token,
            signInData.session.expires_at
          );
          toast.success('Welcome to Vara!', {
            duration: 2500,
            className: 'bg-success-subtle text-success-foreground-subtle border border-success-muted',
          });
          navigate('/onboarding', { replace: true });
        }
      } else {
        setError('Something went wrong. Please try again.');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    }
  };

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold text-foreground">Create your account</h1>
      <p className="mt-2 text-foreground-muted">
        Start your journey to comprehensive digital safety.
      </p>

      {error && (
        <div className="mt-6 rounded-2xl bg-destructive-subtle p-4 text-sm text-destructive-foreground-subtle">
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

        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="Create a strong password"
          hint="At least 8 characters with uppercase, lowercase, and a number"
          error={errors.password?.message}
          showPasswordToggle
          {...register('password')}
        />

        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          placeholder="Confirm your password"
          error={errors.confirmPassword?.message}
          showPasswordToggle
          {...register('confirmPassword')}
        />

        <div className="text-sm text-foreground-muted">
          By creating an account, you agree to our{' '}
          <a href="#" className="text-primary hover:text-primary-hover">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="#" className="text-primary hover:text-primary-hover">
            Privacy Policy
          </a>
          .
        </div>

        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          Create account
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-foreground-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-primary hover:text-primary-hover">
          Sign in
        </Link>
      </p>
    </div>
  );
}
