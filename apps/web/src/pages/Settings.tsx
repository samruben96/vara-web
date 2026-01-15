import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Settings as SettingsIcon,
  User,
  Lock,
  Bell,
  Shield,
  AlertTriangle,
} from 'lucide-react';

import {
  ProfileSettings,
  SecuritySettings,
  NotificationSettings,
  PrivacySettings,
  DangerZone,
} from '../components/settings';
import { cn } from '../lib/cn';

type SettingsTab = 'profile' | 'security' | 'notifications' | 'privacy' | 'danger';

interface TabConfig {
  id: SettingsTab;
  label: string;
  icon: typeof User;
  component: React.ComponentType;
  description: string;
}

const tabs: TabConfig[] = [
  {
    id: 'profile',
    label: 'Profile',
    icon: User,
    component: ProfileSettings,
    description: 'Manage your personal information',
  },
  {
    id: 'security',
    label: 'Security',
    icon: Lock,
    component: SecuritySettings,
    description: 'Password and authentication settings',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell,
    component: NotificationSettings,
    description: 'Control how we contact you',
  },
  {
    id: 'privacy',
    label: 'Privacy',
    icon: Shield,
    component: PrivacySettings,
    description: 'Data collection and usage',
  },
  {
    id: 'danger',
    label: 'Danger Zone',
    icon: AlertTriangle,
    component: DangerZone,
    description: 'Irreversible account actions',
  },
];

export function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as SettingsTab | null;
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    tabParam && tabs.some((t) => t.id === tabParam) ? tabParam : 'profile'
  );

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    setSearchParams(tab === 'profile' ? {} : { tab });
  };

  // Type assertion is safe because tabs array is never empty and activeTab defaults to 'profile'
  const currentTab = (tabs.find((t) => t.id === activeTab) ?? tabs[0]) as TabConfig;
  const TabContent = currentTab.component;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-subtle">
          <SettingsIcon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-foreground-muted">Manage your account preferences and security</p>
        </div>
      </div>

      {/* Settings Layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Navigation - Desktop */}
        <nav
          className="hidden lg:block w-64 flex-shrink-0"
          aria-label="Settings navigation"
        >
          <div className="sticky top-6 space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const isDanger = tab.id === 'danger';

              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left',
                    'transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                    isActive
                      ? isDanger
                        ? 'bg-destructive-subtle text-destructive-foreground-subtle'
                        : 'bg-primary-subtle text-primary'
                      : isDanger
                        ? 'text-destructive hover:bg-destructive-subtle'
                        : 'text-foreground-muted hover:bg-muted hover:text-foreground'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5 flex-shrink-0',
                      isActive
                        ? isDanger
                          ? 'text-destructive'
                          : 'text-primary'
                        : isDanger
                          ? 'text-destructive'
                          : 'text-foreground-subtle'
                    )}
                  />
                  <div className="min-w-0">
                    <span className="font-medium block">{tab.label}</span>
                    <span
                      className={cn(
                        'text-xs truncate block',
                        isActive
                          ? isDanger
                            ? 'text-destructive'
                            : 'text-primary'
                          : 'text-foreground-subtle'
                      )}
                    >
                      {tab.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Mobile Tab Navigation */}
        <div className="lg:hidden">
          <div
            className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide"
            role="tablist"
            aria-label="Settings tabs"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const isDanger = tab.id === 'danger';

              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`tabpanel-${tab.id}`}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap',
                    'text-sm font-medium transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                    isActive
                      ? isDanger
                        ? 'bg-destructive-subtle text-destructive-foreground-subtle'
                        : 'bg-primary-subtle text-primary'
                      : isDanger
                        ? 'bg-muted text-destructive hover:bg-destructive-subtle'
                        : 'bg-muted text-foreground-muted hover:bg-muted-hover'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div
          className="flex-1 min-w-0"
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
        >
          {/* Section Header - Mobile */}
          <div className="lg:hidden mb-6">
            <h2 className="text-lg font-semibold text-foreground">{currentTab.label}</h2>
            <p className="text-sm text-foreground-muted">{currentTab.description}</p>
          </div>

          {/* Tab Content Card */}
          <div className="card p-4 sm:p-6">
            <TabContent />
          </div>
        </div>
      </div>
    </div>
  );
}

// Default export for lazy loading
export default Settings;
