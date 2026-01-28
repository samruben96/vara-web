import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  Eye,
  Database,
  Download,
  Shield,
  Lock,
  FileText,
  CheckCircle,
  Loader2,
} from 'lucide-react';

import { Button } from '../ui/Button';
import { cn } from '../../lib/cn';

interface DataCardProps {
  icon: typeof Eye;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
}

function DataCard({ icon: Icon, iconBg, iconColor, title, description }: DataCardProps) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0', iconBg)}>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>
      <div>
        <h4 className="font-medium text-foreground text-sm">{title}</h4>
        <p className="text-xs text-foreground-muted mt-0.5">{description}</p>
      </div>
    </div>
  );
}

export function PrivacySettings() {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportData = () => {
    setIsExporting(true);
    // Simulate export delay
    setTimeout(() => {
      setIsExporting(false);
      toast.success('Data export feature coming soon!', {
        duration: 3000,
        style: { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' },
        icon: '(info)',
      });
    }, 1000);
  };

  return (
    <div className="space-y-6">
      {/* Data We Collect Section */}
      <div className="rounded-2xl border border-border/40 p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <Database className="h-5 w-5 text-primary" />
          <h3 className="font-serif font-semibold text-foreground">Data We Collect</h3>
        </div>

        <p className="text-sm text-foreground-muted mb-4">
          Vara collects only the information necessary to protect your digital presence. Here is
          what we store:
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <DataCard
            icon={Eye}
            iconBg="bg-primary-subtle"
            iconColor="text-primary"
            title="Account Information"
            description="Email, display name, and account settings"
          />
          <DataCard
            icon={Shield}
            iconBg="bg-info-subtle"
            iconColor="text-info"
            title="Protected Images"
            description="Images you upload for monitoring"
          />
          <DataCard
            icon={Lock}
            iconBg="bg-success-subtle"
            iconColor="text-success"
            title="Connected Accounts"
            description="OAuth tokens for linked social accounts"
          />
          <DataCard
            icon={FileText}
            iconBg="bg-warning-subtle"
            iconColor="text-warning"
            title="Scan Results"
            description="Alerts and detection history"
          />
        </div>
      </div>

      {/* How We Use Your Data */}
      <div className="rounded-2xl border border-border/40 p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="h-5 w-5 text-success" />
          <h3 className="font-serif font-semibold text-foreground">How We Use Your Data</h3>
        </div>

        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground text-sm">Protect Your Images</p>
              <p className="text-sm text-foreground-muted">
                We scan the web for unauthorized use of your uploaded images
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground text-sm">Monitor for Impersonation</p>
              <p className="text-sm text-foreground-muted">
                We check for fake profiles using your identity across platforms
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground text-sm">Data Breach Monitoring</p>
              <p className="text-sm text-foreground-muted">
                We check if your email appears in known data breaches
              </p>
            </div>
          </li>
        </ul>

        {/* Privacy Commitment */}
        <div className="mt-4 p-4 rounded-lg bg-success-subtle border border-success-muted">
          <h4 className="font-serif font-medium text-success-foreground-subtle text-sm mb-2">Our Privacy Commitment</h4>
          <ul className="space-y-1 text-sm text-success">
            <li>- We never sell your personal data</li>
            <li>- We never share your images with third parties</li>
            <li>- All data is encrypted at rest and in transit</li>
            <li>- You can delete your account and all data at any time</li>
          </ul>
        </div>
      </div>

      {/* Export Your Data */}
      <div className="rounded-2xl border border-border/40 p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-2">
          <Download className="h-5 w-5 text-primary" />
          <h3 className="font-serif font-semibold text-foreground">Export Your Data</h3>
        </div>

        <p className="text-sm text-foreground-muted mb-4">
          You can request a copy of all your personal data that Vara stores. This includes your
          account information, protected images, alerts, and scan history.
        </p>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={handleExportData}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Preparing Export...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export My Data
              </>
            )}
          </Button>
          <span className="text-xs text-foreground-subtle">
            Export will be available as a ZIP file
          </span>
        </div>

        <div className="mt-4 rounded-lg bg-warning-subtle border border-warning-muted p-3">
          <p className="text-sm text-warning">
            <strong>Note:</strong> Data export functionality is coming soon. This feature will
            allow you to download a complete copy of your data in a portable format.
          </p>
        </div>
      </div>

      {/* Legal Links */}
      <div className="rounded-2xl border border-border/40 p-4 sm:p-6">
        <h3 className="font-serif font-semibold text-foreground mb-4">Legal Documents</h3>

        <div className="space-y-3">
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg',
              'bg-muted hover:bg-muted-hover transition-colors'
            )}
          >
            <FileText className="h-5 w-5 text-foreground-subtle" />
            <div>
              <p className="font-medium text-foreground text-sm">Privacy Policy</p>
              <p className="text-xs text-foreground-muted">How we collect and use your data</p>
            </div>
          </a>

          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg',
              'bg-muted hover:bg-muted-hover transition-colors'
            )}
          >
            <FileText className="h-5 w-5 text-foreground-subtle" />
            <div>
              <p className="font-medium text-foreground text-sm">Terms of Service</p>
              <p className="text-xs text-foreground-muted">Our terms and conditions</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
