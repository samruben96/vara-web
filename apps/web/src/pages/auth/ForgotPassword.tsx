import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@vara/shared';
import { Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';

export function ForgotPassword() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    setError(null);

    try {
      const { error: authError } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      toast.success('Check your email for reset instructions', {
        duration: 3000,
        style: { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' },
      });
      setSuccess(true);
    } catch {
      setError('An unexpected error occurred. Please try again.');
    }
  };

  if (success) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-100">
          <svg
            className="h-8 w-8 text-success-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="mt-6 text-2xl font-bold text-neutral-900">Check your email</h1>
        <p className="mt-2 text-neutral-600">
          If an account exists with that email, we've sent you a password reset link.
        </p>
        <div className="mt-8">
          <Link to="/login">
            <Button variant="secondary">
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link
        to="/login"
        className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sign in
      </Link>

      <h1 className="mt-6 text-2xl font-bold text-neutral-900">Reset your password</h1>
      <p className="mt-2 text-neutral-600">
        Enter your email address and we'll send you a link to reset your password.
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

        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          Send reset link
        </Button>
      </form>
    </div>
  );
}
