import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Bell, Mail, AlertTriangle, Image, User, Shield, Save } from 'lucide-react';

import { Button } from '../ui/Button';
import { cn } from '../../lib/cn';

// Local storage key for notification preferences
const NOTIFICATION_PREFS_KEY = 'vara-notification-preferences';

interface NotificationPreferences {
  emailAlerts: boolean;
  emailDigest: boolean;
  imageAlerts: boolean;
  profileAlerts: boolean;
  breachAlerts: boolean;
  marketingEmails: boolean;
}

const defaultPreferences: NotificationPreferences = {
  emailAlerts: true,
  emailDigest: true,
  imageAlerts: true,
  profileAlerts: true,
  breachAlerts: true,
  marketingEmails: false,
};

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label: string;
}

function ToggleSwitch({ enabled, onChange, label }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      onClick={() => onChange(!enabled)}
      className={cn(
        'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full',
        'border-2 border-transparent transition-colors duration-200 ease-in-out',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        enabled ? 'bg-primary' : 'bg-muted'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 transform rounded-full',
          'bg-card shadow ring-0 transition duration-200 ease-in-out',
          enabled ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  );
}

interface NotificationRowProps {
  icon: typeof Bell;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

function NotificationRow({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  description,
  enabled,
  onChange,
}: NotificationRowProps) {
  return (
    <div className="flex items-start gap-4 py-4">
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', iconBg)}>
        <Icon className={cn('h-5 w-5', iconColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-foreground">{title}</h4>
        <p className="text-sm text-foreground-muted">{description}</p>
      </div>
      <ToggleSwitch enabled={enabled} onChange={onChange} label={title} />
    </div>
  );
}

export function NotificationSettings() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load preferences from local storage on mount
  useEffect(() => {
    const stored = localStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as NotificationPreferences;
        setPreferences({ ...defaultPreferences, ...parsed });
      } catch {
        // Use defaults if parsing fails
      }
    }
  }, []);

  const updatePreference = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    setIsSaving(true);
    // Simulate save delay
    setTimeout(() => {
      localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(preferences));
      setHasChanges(false);
      setIsSaving(false);
      toast.success('Notification preferences saved', {
        duration: 3000,
        style: { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' },
      });
    }, 500);
  };

  return (
    <div className="space-y-6">
      {/* Email Notifications Section */}
      <div className="rounded-2xl border border-border/40 p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-2">
          <Mail className="h-5 w-5 text-primary" />
          <h3 className="font-serif font-semibold text-foreground">Email Notifications</h3>
        </div>
        <p className="text-sm text-foreground-muted mb-4">
          Control which emails you receive from Vara
        </p>

        <div className="divide-y divide-border-subtle">
          <NotificationRow
            icon={Bell}
            iconBg="bg-primary-subtle"
            iconColor="text-primary"
            title="Alert Notifications"
            description="Get notified immediately when we detect potential threats"
            enabled={preferences.emailAlerts}
            onChange={(v) => updatePreference('emailAlerts', v)}
          />

          <NotificationRow
            icon={Shield}
            iconBg="bg-info-subtle"
            iconColor="text-info"
            title="Weekly Digest"
            description="Receive a weekly summary of your protection status"
            enabled={preferences.emailDigest}
            onChange={(v) => updatePreference('emailDigest', v)}
          />

          <NotificationRow
            icon={Mail}
            iconBg="bg-muted"
            iconColor="text-foreground-muted"
            title="Product Updates"
            description="News about new features and improvements"
            enabled={preferences.marketingEmails}
            onChange={(v) => updatePreference('marketingEmails', v)}
          />
        </div>
      </div>

      {/* Alert Types Section */}
      <div className="rounded-2xl border border-border/40 p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <h3 className="font-serif font-semibold text-foreground">Alert Types</h3>
        </div>
        <p className="text-sm text-foreground-muted mb-4">
          Choose which types of alerts you want to receive
        </p>

        <div className="divide-y divide-border-subtle">
          <NotificationRow
            icon={Image}
            iconBg="bg-destructive-subtle"
            iconColor="text-destructive"
            title="Image Alerts"
            description="When your protected images are found elsewhere online"
            enabled={preferences.imageAlerts}
            onChange={(v) => updatePreference('imageAlerts', v)}
          />

          <NotificationRow
            icon={User}
            iconBg="bg-warning-subtle"
            iconColor="text-warning"
            title="Profile Alerts"
            description="Fake profiles or impersonation attempts detected"
            enabled={preferences.profileAlerts}
            onChange={(v) => updatePreference('profileAlerts', v)}
          />

          <NotificationRow
            icon={AlertTriangle}
            iconBg="bg-primary-subtle"
            iconColor="text-primary"
            title="Data Breach Alerts"
            description="When your email is found in a data breach"
            enabled={preferences.breachAlerts}
            onChange={(v) => updatePreference('breachAlerts', v)}
          />
        </div>
      </div>

      {/* Info Note */}
      <div className="rounded-lg bg-primary-subtle border border-primary-muted p-4">
        <p className="text-sm text-primary">
          <strong>Note:</strong> These preferences are saved locally for now. Full email
          notification integration is coming soon. Critical security alerts will always be
          sent regardless of these settings.
        </p>
      </div>

      {/* Save Button */}
      {hasChanges && (
        <div className="flex justify-end">
          <Button onClick={handleSave} isLoading={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            Save Preferences
          </Button>
        </div>
      )}
    </div>
  );
}
