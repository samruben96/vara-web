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
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100">
          <SettingsIcon className="h-6 w-6 text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Settings</h1>
          <p className="text-neutral-600">Manage your account preferences and security</p>
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
                    'transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                    isActive
                      ? isDanger
                        ? 'bg-rose-50 text-rose-700'
                        : 'bg-primary-50 text-primary-700'
                      : isDanger
                        ? 'text-rose-600 hover:bg-rose-50'
                        : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5 flex-shrink-0',
                      isActive
                        ? isDanger
                          ? 'text-rose-600'
                          : 'text-primary-600'
                        : isDanger
                          ? 'text-rose-500'
                          : 'text-neutral-400'
                    )}
                  />
                  <div className="min-w-0">
                    <span className="font-medium block">{tab.label}</span>
                    <span
                      className={cn(
                        'text-xs truncate block',
                        isActive
                          ? isDanger
                            ? 'text-rose-600'
                            : 'text-primary-600'
                          : 'text-neutral-400'
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
                    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                    isActive
                      ? isDanger
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-primary-100 text-primary-700'
                      : isDanger
                        ? 'bg-neutral-100 text-rose-600 hover:bg-rose-50'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
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
            <h2 className="text-lg font-semibold text-neutral-900">{currentTab.label}</h2>
            <p className="text-sm text-neutral-600">{currentTab.description}</p>
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
