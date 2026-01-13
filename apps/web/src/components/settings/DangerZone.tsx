import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';

import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { cn } from '../../lib/cn';

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

function DeleteAccountModal({ isOpen, onClose, onConfirm, isDeleting }: DeleteModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const isConfirmValid = confirmText.toLowerCase() === 'delete my account';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
        className={cn(
          'relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl',
          'animate-in fade-in-0 zoom-in-95 duration-200'
        )}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isDeleting}
          className={cn(
            'absolute right-4 top-4 p-1 rounded-lg',
            'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100',
            'focus:outline-none focus:ring-2 focus:ring-neutral-500',
            'transition-colors'
          )}
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Warning Icon */}
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 mx-auto">
          <AlertTriangle className="h-6 w-6 text-rose-600" />
        </div>

        {/* Title */}
        <h2
          id="delete-modal-title"
          className="mt-4 text-xl font-bold text-neutral-900 text-center"
        >
          Delete Your Account?
        </h2>

        {/* Warning Message */}
        <div className="mt-4 rounded-lg bg-rose-50 border border-rose-100 p-4">
          <p className="text-sm text-rose-700 font-medium mb-2">
            This action cannot be undone. The following will be permanently deleted:
          </p>
          <ul className="text-sm text-rose-600 space-y-1">
            <li>- Your account and profile information</li>
            <li>- All protected images and their embeddings</li>
            <li>- All alerts and detection history</li>
            <li>- Connected social media accounts</li>
            <li>- Scan history and results</li>
            <li>- Your personalized protection plan</li>
          </ul>
        </div>

        {/* Confirmation Input */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">
            Type <span className="font-mono bg-neutral-100 px-1 rounded">delete my account</span> to confirm:
          </label>
          <Input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="delete my account"
            disabled={isDeleting}
            autoComplete="off"
          />
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={!isConfirmValid || isDeleting}
            className="flex-1"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Delete Account
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DangerZone() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { logout } = useAuthStore();

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      await api.delete('/api/v1/users/me');
    },
    onSuccess: () => {
      toast.success('Your account has been deleted', {
        duration: 5000,
        style: { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' },
      });
      logout();
      // Redirect to landing page
      window.location.href = '/';
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to delete account');
      setIsModalOpen(false);
    },
  });

  const handleDeleteConfirm = () => {
    deleteAccountMutation.mutate();
  };

  return (
    <div className="space-y-6">
      {/* Warning Header */}
      <div className="rounded-xl border-2 border-rose-200 bg-rose-50 p-4 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 flex-shrink-0">
            <AlertTriangle className="h-6 w-6 text-rose-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-rose-900">Danger Zone</h3>
            <p className="text-sm text-rose-700 mt-1">
              Actions in this section are permanent and cannot be undone. Please proceed with
              caution.
            </p>
          </div>
        </div>
      </div>

      {/* Delete Account Section */}
      <div className="rounded-xl border border-neutral-200 p-4 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100 flex-shrink-0">
            <Trash2 className="h-5 w-5 text-rose-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-neutral-900">Delete Account</h4>
            <p className="text-sm text-neutral-600 mt-1">
              Permanently delete your Vara account and all associated data. This will remove
              your profile, protected images, alerts, scan history, and connected accounts.
            </p>

            {/* What gets deleted */}
            <div className="mt-4 rounded-lg bg-neutral-50 p-4">
              <h5 className="text-sm font-medium text-neutral-700 mb-2">
                What will be deleted:
              </h5>
              <ul className="grid gap-1 text-sm text-neutral-600 sm:grid-cols-2">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                  Account credentials
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                  Profile information
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                  All protected images
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                  Image embeddings
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                  Alerts and matches
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                  Scan history
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                  Connected accounts
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                  Protection plan
                </li>
              </ul>
            </div>

            <div className="mt-4">
              <Button
                variant="danger"
                onClick={() => setIsModalOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete My Account
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Warning */}
      <div className="rounded-lg bg-amber-50 border border-amber-100 p-4">
        <p className="text-sm text-amber-700">
          <strong>Before you go:</strong> If you are experiencing issues with Vara, please
          consider reaching out to our support team first. We would love to help resolve any
          problems and keep protecting your digital presence.
        </p>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteAccountModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        isDeleting={deleteAccountMutation.isPending}
      />
    </div>
  );
}
