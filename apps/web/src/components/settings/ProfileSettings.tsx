import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { User, Camera, Loader2 } from 'lucide-react';

import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { cn } from '../../lib/cn';

// Schema for profile update - matches backend
const profileSchema = z.object({
  displayName: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')
    .optional()
    .or(z.literal('')),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export function ProfileSettings() {
  const { user, setUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: user?.profile?.displayName || '',
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const response = await api.patch<{ displayName: string | null }>('/api/v1/users/me', {
        displayName: data.displayName || null,
      });
      return response.data;
    },
    onSuccess: (data) => {
      // Update auth store with new profile data
      if (user) {
        setUser({
          ...user,
          profile: user.profile
            ? { ...user.profile, displayName: data.displayName }
            : null,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['user'] });
      setIsEditing(false);
      toast.success('Profile updated successfully', {
        duration: 3000,
        style: { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' },
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update profile');
    },
  });

  const onSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

  const handleCancel = () => {
    reset({ displayName: user?.profile?.displayName || '' });
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="relative">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-subtle">
            <User className="h-10 w-10 text-primary" />
          </div>
          <button
            type="button"
            className={cn(
              'absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center',
              'rounded-full bg-card border border-border shadow-sm',
              'text-foreground-subtle hover:text-primary hover:border-primary-muted',
              'transition-colors cursor-not-allowed opacity-50'
            )}
            disabled
            title="Profile picture upload coming soon"
            aria-label="Upload profile picture (coming soon)"
          >
            <Camera className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1">
          <h3 className="font-semibold text-foreground">
            {user?.profile?.displayName || 'Your Profile'}
          </h3>
          <p className="text-sm text-foreground-muted">{user?.email}</p>
          <p className="mt-1 text-xs text-foreground-subtle">
            Profile picture upload coming soon
          </p>
        </div>
      </div>

      {/* Profile Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Display Name"
          placeholder="Enter your display name"
          disabled={!isEditing || updateProfileMutation.isPending}
          error={errors.displayName?.message}
          {...register('displayName')}
        />

        <div>
          <label className="block text-sm font-medium text-foreground-muted mb-1.5">
            Email Address
          </label>
          <div className="w-full rounded-lg border border-border bg-muted px-4 py-3 text-base sm:text-sm text-foreground-muted">
            {user?.email}
          </div>
          <p className="mt-1.5 text-xs text-foreground-subtle">
            Email address cannot be changed
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground-muted mb-1.5">
            Account Created
          </label>
          <div className="w-full rounded-lg border border-border bg-muted px-4 py-3 text-base sm:text-sm text-foreground-muted">
            {user?.profile?.createdAt
              ? new Date(user.profile.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })
              : 'Unknown'}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          {isEditing ? (
            <>
              <Button
                type="submit"
                isLoading={updateProfileMutation.isPending}
                disabled={!isDirty}
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleCancel}
                disabled={updateProfileMutation.isPending}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsEditing(true)}
            >
              Edit Profile
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
