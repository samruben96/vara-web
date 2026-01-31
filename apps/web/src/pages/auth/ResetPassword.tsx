import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { passwordSchema } from '@vara/shared';
import { Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { toastPresets } from '../../lib/toastStyles';

// Local schema for reset password form (without token since Supabase handles it via session)
const resetPasswordFormSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type ResetPasswordFormInput = z.infer<typeof resetPasswordFormSchema>;

export function ResetPassword() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormInput>({
    resolver: zodResolver(resetPasswordFormSchema),
  });

  // Verify the user has a valid recovery session
  useEffect(() => {
    const checkSession = async () => {
      // Supabase handles the token exchange automatically via URL hash
      // We need to check if there's an active session with recovery type
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        setError('Unable to verify reset link. Please request a new password reset.');
        setIsValidSession(false);
        return;
      }

      // Check if we have a valid session (Supabase exchanges the token automatically)
      if (session) {
        setIsValidSession(true);
      } else {
        // Check for error or expired token in URL params
        const errorDescription = searchParams.get('error_description');
        if (errorDescription) {
          setError(decodeURIComponent(errorDescription));
          setIsValidSession(false);
        } else {
          setError('Invalid or expired reset link. Please request a new password reset.');
          setIsValidSession(false);
        }
      }
    };

    checkSession();
  }, [searchParams]);

  const onSubmit = async (data: ResetPasswordFormInput) => {
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      // Sign out after password update to ensure clean state
      await supabase.auth.signOut();

      setSuccess(true);
      toast.success('Password updated successfully!', toastPresets.success);

      // Redirect to login after a brief delay
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2000);
    } catch {
      setError('An unexpected error occurred. Please try again.');
    }
  };

  // Loading state while checking session
  if (isValidSession === null) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-muted border-t-primary" />
        <p className="mt-4 text-sm text-foreground-muted">Verifying reset link...</p>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-subtle">
          <CheckCircle className="h-8 w-8 text-success" />
        </div>
        <h1 className="mt-6 font-serif text-2xl font-bold text-foreground">Password updated</h1>
        <p className="mt-2 text-foreground-muted">
          Your password has been successfully reset. You'll be redirected to sign in shortly.
        </p>
        <div className="mt-8">
          <Link to="/login">
            <Button variant="secondary">
              <ArrowLeft className="h-4 w-4" />
              Go to sign in
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Invalid session state
  if (!isValidSession) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive-subtle">
          <svg
            className="h-8 w-8 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h1 className="mt-6 font-serif text-2xl font-bold text-foreground">Reset link invalid</h1>
        <p className="mt-2 text-foreground-muted">
          {error || 'This password reset link is invalid or has expired.'}
        </p>
        <div className="mt-8 space-y-3">
          <Link to="/forgot-password" className="block">
            <Button className="w-full">Request new reset link</Button>
          </Link>
          <Link to="/login">
            <Button variant="secondary" className="w-full">
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Valid session - show password reset form
  return (
    <div>
      <Link
        to="/login"
        className="inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sign in
      </Link>

      <h1 className="mt-6 font-serif text-2xl font-bold text-foreground">Create new password</h1>
      <p className="mt-2 text-foreground-muted">
        Enter your new password below. Make sure it's strong and unique.
      </p>

      {error && (
        <div className="mt-6 rounded-2xl bg-destructive-subtle p-4 text-sm text-destructive-foreground-subtle">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          placeholder="Create a strong password"
          hint="At least 8 characters with uppercase, lowercase, and a number"
          error={errors.password?.message}
          {...register('password')}
        />

        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          placeholder="Confirm your new password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          Reset password
        </Button>
      </form>
    </div>
  );
}
