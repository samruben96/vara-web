import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Lock, Shield, Smartphone, CheckCircle, Loader2 } from 'lucide-react';

import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { cn } from '../../lib/cn';
import { supabase } from '../../lib/supabase';

// Password validation schema
const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100, 'Password must be less than 100 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

export function SecuritySettings() {
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
  });

  const onSubmit = async (data: ChangePasswordFormData) => {
    setIsSubmitting(true);
    try {
      // Use Supabase to update password
      const { error } = await supabase.auth.updateUser({
        password: data.newPassword,
      });

      if (error) {
        throw error;
      }

      toast.success('Password updated successfully', {
        duration: 3000,
        style: { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' },
      });
      reset();
      setIsChangingPassword(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update password';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    reset();
    setIsChangingPassword(false);
  };

  return (
    <div className="space-y-6">
      {/* Password Section */}
      <div className="rounded-xl border border-neutral-200 p-4 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
            <Lock className="h-5 w-5 text-primary-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-neutral-900">Password</h3>
            <p className="text-sm text-neutral-600">
              Keep your account secure by using a strong password
            </p>
          </div>
        </div>

        {isChangingPassword ? (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
            <Input
              type="password"
              label="Current Password"
              placeholder="Enter your current password"
              showPasswordToggle
              error={errors.currentPassword?.message}
              {...register('currentPassword')}
            />

            <Input
              type="password"
              label="New Password"
              placeholder="Enter your new password"
              showPasswordToggle
              hint="Must be at least 8 characters with uppercase, lowercase, and a number"
              error={errors.newPassword?.message}
              {...register('newPassword')}
            />

            <Input
              type="password"
              label="Confirm New Password"
              placeholder="Confirm your new password"
              showPasswordToggle
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Password'
                )}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="mt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsChangingPassword(true)}
            >
              Change Password
            </Button>
          </div>
        )}
      </div>

      {/* Two-Factor Authentication Section */}
      <div className="rounded-xl border border-neutral-200 p-4 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100">
            <Smartphone className="h-5 w-5 text-neutral-500" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-neutral-900">Two-Factor Authentication</h3>
              <span className="inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
                Coming Soon
              </span>
            </div>
            <p className="text-sm text-neutral-600">
              Add an extra layer of security to your account with 2FA
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-neutral-50 p-4">
          <p className="text-sm text-neutral-600">
            Two-factor authentication will be available soon. This feature will allow you to
            secure your account with an authenticator app or SMS verification.
          </p>
        </div>
      </div>

      {/* Session Security */}
      <div className="rounded-xl border border-neutral-200 p-4 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-100">
            <Shield className="h-5 w-5 text-success-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-neutral-900">Session Security</h3>
            <p className="text-sm text-neutral-600">
              Your session is protected with secure authentication
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 text-success-700">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Secure session active</span>
        </div>

        <div className={cn(
          'mt-4 rounded-lg bg-neutral-50 p-4',
          'border border-neutral-100'
        )}>
          <h4 className="text-sm font-medium text-neutral-700 mb-2">Security Tips</h4>
          <ul className="space-y-2 text-sm text-neutral-600">
            <li className="flex items-start gap-2">
              <span className="text-primary-600">-</span>
              Use a unique password for your Vara account
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-600">-</span>
              Never share your login credentials with anyone
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-600">-</span>
              Log out when using shared devices
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
