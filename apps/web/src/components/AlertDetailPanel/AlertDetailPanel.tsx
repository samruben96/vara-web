import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Shield,
  AlertTriangle,
  Image,
  User,
  Database,
  Eye,
  ExternalLink,
  Download,
  Archive,
  CheckCircle,
  Clock,
  Link2,
  FileText,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button } from '../ui/Button';
import { useAlert } from '../../hooks/useAlerts';
import { useLockBodyScroll } from '../../hooks/mobile/useLockBodyScroll';
import type { AlertType, AlertSeverity } from '@vara/shared';

interface AlertDetailPanelProps {
  alertId: string | null;
  onClose: () => void;
  onDismiss: (id: string) => void;
  onMarkViewed: (id: string) => void;
  onMarkActioned: (id: string) => void;
  isUpdating: boolean;
}

// Severity configuration using Vara's calming semantic color system
const severityConfig: Record<AlertSeverity, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof AlertTriangle;
}> = {
  CRITICAL: {
    label: 'Critical',
    color: 'text-alert-critical-text',
    bgColor: 'bg-alert-critical-bg',
    borderColor: 'border-alert-critical-border',
    icon: AlertTriangle,
  },
  HIGH: {
    label: 'High Priority',
    color: 'text-alert-high-text',
    bgColor: 'bg-alert-high-bg',
    borderColor: 'border-alert-high-border',
    icon: AlertTriangle,
  },
  MEDIUM: {
    label: 'Medium',
    color: 'text-alert-medium-text',
    bgColor: 'bg-alert-medium-bg',
    borderColor: 'border-alert-medium-border',
    icon: Eye,
  },
  LOW: {
    label: 'Low',
    color: 'text-alert-low-text',
    bgColor: 'bg-alert-low-bg',
    borderColor: 'border-alert-low-border',
    icon: Eye,
  },
  INFO: {
    label: 'Info',
    color: 'text-alert-info-text',
    bgColor: 'bg-alert-info-bg',
    borderColor: 'border-alert-info-border',
    icon: Shield,
  },
};

// Alert type configuration with detailed explanations
const alertTypeConfig: Record<AlertType, {
  label: string;
  icon: typeof Image;
  explanation: string;
  nextSteps: string[];
  reportLinks: { platform: string; url: string; label: string }[];
}> = {
  IMAGE_MISUSE: {
    label: 'Image Found Online',
    icon: Image,
    explanation: 'We found an image that closely matches one of your protected photos on another website or platform. This could mean your image is being used without your permission.',
    nextSteps: [
      'Review the source to confirm this is your image',
      'Take a screenshot of the page for your records',
      'If unauthorized, report the content to the platform',
      'Consider sending a DMCA takedown request if the platform does not respond',
      'Document all actions taken for potential legal purposes',
    ],
    reportLinks: [
      { platform: 'Instagram', url: 'https://help.instagram.com/contact/504521742987441', label: 'Report to Instagram' },
      { platform: 'Facebook', url: 'https://www.facebook.com/help/contact/144059062408922', label: 'Report to Facebook' },
      { platform: 'TikTok', url: 'https://www.tiktok.com/legal/report/Copyright', label: 'Report to TikTok' },
      { platform: 'Twitter', url: 'https://help.twitter.com/forms/dmca', label: 'Report to Twitter/X' },
      { platform: 'Google', url: 'https://support.google.com/legal/troubleshooter/1114905', label: 'Google Removal Request' },
    ],
  },
  FAKE_PROFILE: {
    label: 'Fake Profile Detected',
    icon: User,
    explanation: 'We detected a profile that appears to be impersonating you. This account may be using your photos, name, or other identifying information to deceive others.',
    nextSteps: [
      'Do not engage with or contact the fake profile directly',
      'Document the profile with screenshots (username, photos, bio)',
      'Report the impersonation to the platform using official channels',
      'Alert your friends and followers about the fake account',
      'If harassment occurs, consider contacting local authorities',
    ],
    reportLinks: [
      { platform: 'Instagram', url: 'https://help.instagram.com/contact/636276399721841', label: 'Report Impersonation' },
      { platform: 'Facebook', url: 'https://www.facebook.com/help/contact/169486816475808', label: 'Report Fake Account' },
      { platform: 'TikTok', url: 'https://support.tiktok.com/en/safety-hc/report-a-problem/report-a-user', label: 'Report Account' },
      { platform: 'Twitter', url: 'https://help.twitter.com/forms/impersonation', label: 'Report Impersonation' },
      { platform: 'LinkedIn', url: 'https://www.linkedin.com/help/linkedin/answer/a1339364', label: 'Report Fake Profile' },
    ],
  },
  DATA_BREACH: {
    label: 'Data Breach Alert',
    icon: Database,
    explanation: 'Your email or personal information was found in a known data breach. This means your data may have been exposed when a company or service experienced a security incident.',
    nextSteps: [
      'Change your password for the affected service immediately',
      'Update passwords on any accounts using similar credentials',
      'Enable two-factor authentication where available',
      'Monitor your accounts for suspicious activity',
      'Consider using a password manager for unique passwords',
      'Check your credit report if financial data was involved',
    ],
    reportLinks: [
      { platform: 'Have I Been Pwned', url: 'https://haveibeenpwned.com/', label: 'Check Other Breaches' },
      { platform: 'FTC', url: 'https://www.identitytheft.gov/', label: 'Report Identity Theft (US)' },
      { platform: 'Credit Freeze', url: 'https://www.consumer.ftc.gov/articles/0497-credit-freeze-faqs', label: 'Learn About Credit Freeze' },
    ],
  },
  SUSPICIOUS_FOLLOWER: {
    label: 'Suspicious Account Activity',
    icon: Eye,
    explanation: 'We noticed unusual activity from an account interacting with your profile. This could indicate someone monitoring your activity or attempting to gather information about you.',
    nextSteps: [
      'Review the suspicious account\'s profile and recent activity',
      'Consider blocking or restricting the account',
      'Review your privacy settings to limit what strangers can see',
      'Be cautious about accepting follow requests from unknown accounts',
      'Document any concerning behavior',
    ],
    reportLinks: [
      { platform: 'Instagram', url: 'https://help.instagram.com/contact/497253480400030', label: 'Report Harassment' },
      { platform: 'Facebook', url: 'https://www.facebook.com/help/181495968648557', label: 'Report Suspicious Account' },
      { platform: 'TikTok', url: 'https://support.tiktok.com/en/safety-hc/report-a-problem', label: 'Report User' },
    ],
  },
  BEHAVIORAL_CHANGE: {
    label: 'Behavior Change Detected',
    icon: AlertTriangle,
    explanation: 'We detected a significant change in how someone is interacting with your online presence. This could indicate increased interest or monitoring of your accounts.',
    nextSteps: [
      'Review your recent posts and interactions',
      'Check for any new followers or accounts viewing your content',
      'Consider temporarily increasing your privacy settings',
      'Trust your instincts if something feels wrong',
      'Document any concerning patterns',
    ],
    reportLinks: [
      { platform: 'Instagram', url: 'https://help.instagram.com/contact/497253480400030', label: 'Report Concern' },
      { platform: 'Facebook', url: 'https://www.facebook.com/help/181495968648557', label: 'Report Concern' },
    ],
  },
  DEEPFAKE_DETECTED: {
    label: 'Deepfake Detected',
    icon: AlertTriangle,
    explanation: 'We detected an artificially generated or manipulated image or video that appears to use your likeness. Deepfakes use AI to create realistic but fake content.',
    nextSteps: [
      'Do not share or spread the content further',
      'Document the location and save evidence of the deepfake',
      'Report to the hosting platform immediately',
      'Consider consulting with a legal professional',
      'Report to the FBI IC3 if in the United States',
      'Reach out to organizations like CCRI for support',
    ],
    reportLinks: [
      { platform: 'FBI IC3', url: 'https://www.ic3.gov/', label: 'Report to FBI (US)' },
      { platform: 'CCRI', url: 'https://cybercivilrights.org/', label: 'Cyber Civil Rights Initiative' },
      { platform: 'StopNCII', url: 'https://stopncii.org/', label: 'Stop Non-Consensual Intimate Images' },
      { platform: 'Instagram', url: 'https://help.instagram.com/contact/504521742987441', label: 'Report to Instagram' },
      { platform: 'Facebook', url: 'https://www.facebook.com/help/contact/144059062408922', label: 'Report to Facebook' },
    ],
  },
  PROFILE_IMPERSONATION: {
    label: 'Profile Impersonation',
    icon: User,
    explanation: 'Someone appears to be creating accounts that impersonate your identity across platforms. This may involve using your photos, bio, or username variations.',
    nextSteps: [
      'Document all impersonating profiles with screenshots',
      'Report each impersonating account to the platform',
      'Consider making your legitimate accounts more identifiable',
      'Alert your network about the impersonation',
      'If scams are involved, report to relevant authorities',
    ],
    reportLinks: [
      { platform: 'Instagram', url: 'https://help.instagram.com/contact/636276399721841', label: 'Report Impersonation' },
      { platform: 'Facebook', url: 'https://www.facebook.com/help/contact/169486816475808', label: 'Report Impersonation' },
      { platform: 'TikTok', url: 'https://support.tiktok.com/en/safety-hc/report-a-problem/report-a-user', label: 'Report User' },
      { platform: 'FTC', url: 'https://reportfraud.ftc.gov/', label: 'Report Fraud (US)' },
    ],
  },
};

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function AlertDetailPanel({
  alertId,
  onClose,
  onDismiss,
  onMarkViewed,
  onMarkActioned,
  isUpdating,
}: AlertDetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const hasMarkedViewed = useRef<string | null>(null);

  const { data, isLoading, error } = useAlert(alertId || '', !!alertId);
  const alert = data?.data;

  useLockBodyScroll(!!alertId);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && alertId) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [alertId, onClose]);

  useEffect(() => {
    if (alertId) {
      closeButtonRef.current?.focus();
    }
  }, [alertId]);

  useEffect(() => {
    if (alert?.status === 'NEW' && alert.id !== hasMarkedViewed.current && onMarkViewed) {
      hasMarkedViewed.current = alert.id;
      onMarkViewed(alert.id);
    }
  }, [alert?.id, alert?.status, onMarkViewed]);

  const severity = alert ? severityConfig[alert.severity] : null;
  const alertType = alert ? alertTypeConfig[alert.type] : null;
  const SeverityIcon = severity?.icon || Shield;
  const TypeIcon = alertType?.icon || Shield;

  const metadata = alert?.metadata as {
    sourceUrl?: string;
    platform?: string;
    similarity?: number;
    matchId?: string;
    isMock?: boolean;
    breaches?: Array<{ name: string; breachDate: string; dataClasses: string[] }>;
    relatedAlerts?: Array<{ id: string; title: string }>;
  } | null;

  const relevantReportLinks = alertType?.reportLinks.filter(link => {
    if (!metadata?.platform) return true;
    return link.platform.toLowerCase() === metadata.platform.toLowerCase() ||
           ['Have I Been Pwned', 'FTC', 'FBI IC3', 'CCRI', 'StopNCII', 'Credit Freeze', 'Google'].includes(link.platform);
  }) || [];

  const handleSaveEvidence = () => {
    alert && window.alert('Evidence saving feature coming soon. For now, we recommend taking screenshots.');
  };

  return (
    <>
      <motion.div
        className="fixed inset-0 z-[70] bg-charcoal-900/50"
        onClick={onClose}
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      />

      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-detail-title"
        className={cn(
          'fixed inset-y-0 right-0 z-[80] w-full max-w-lg bg-card shadow-xl',
          'flex flex-col',
        )}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        {isLoading && (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="flex flex-1 flex-col items-center justify-center p-6">
            <AlertTriangle className="h-12 w-12 text-warning mb-4" />
            <p className="text-foreground-muted text-center">Unable to load alert details.</p>
            <Button variant="secondary" onClick={onClose} className="mt-4">
              Close
            </Button>
          </div>
        )}

        {alert && severity && alertType && (
          <>
            <div className={cn('flex items-start gap-4 p-6 border-b', severity.bgColor, severity.borderColor)}>
              <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/80')}>
                <SeverityIcon className={cn('h-6 w-6', severity.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn(
                    'text-xs font-semibold px-2 py-1 rounded-full',
                    severity.bgColor,
                    severity.color,
                    'border',
                    severity.borderColor
                  )}>
                    {severity.label}
                  </span>
                  {metadata?.isMock && (
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-primary-subtle text-primary border border-primary-muted">
                      Test Data
                    </span>
                  )}
                </div>
                <h2 id="alert-detail-title" className="text-lg font-semibold font-serif text-foreground leading-tight">
                  {alert.title}
                </h2>
                <p className="mt-1 text-sm text-foreground-muted flex items-center gap-1">
                  <TypeIcon className="h-4 w-4" />
                  {alertType.label}
                </p>
              </div>
              <button
                ref={closeButtonRef}
                onClick={onClose}
                className="shrink-0 p-2 rounded-lg hover:bg-white/50 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Close panel"
              >
                <X className="h-5 w-5 text-foreground-subtle" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="flex items-center gap-2 text-sm text-foreground-subtle">
                <Clock className="h-4 w-4" />
                <span>Detected {formatDate(alert.createdAt)}</span>
              </div>

              <div>
                <h3 className="font-serif text-base font-semibold text-foreground-muted mb-2">What we noticed</h3>
                <p className="text-foreground-muted leading-relaxed">{alert.description}</p>
              </div>

              {metadata?.sourceUrl && (
                <div className="rounded-xl bg-background-subtle border border-border/40 p-4">
                  <h3 className="text-sm font-semibold text-foreground-muted mb-2 flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    Source Location
                  </h3>
                  <a
                    href={metadata.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary-hover text-sm break-all inline-flex items-center gap-1"
                  >
                    {metadata.platform || (() => { try { return new URL(metadata.sourceUrl!).hostname; } catch { return metadata.sourceUrl; } })()}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                  {metadata.similarity && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-sm text-foreground-muted">Match confidence:</span>
                      <div className="flex-1 h-2 bg-background-elevated rounded-full overflow-hidden max-w-32 border border-border">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${metadata.similarity * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-foreground-muted">
                        {Math.round(metadata.similarity * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              )}

              {metadata?.breaches && metadata.breaches.length > 0 && (
                <div className="rounded-xl bg-background-subtle border border-border/40 p-4">
                  <h3 className="text-sm font-semibold text-foreground-muted mb-3 flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Affected Services ({metadata.breaches.length})
                  </h3>
                  <ul className="space-y-3">
                    {metadata.breaches.map((breach, idx) => (
                      <li key={idx} className="text-sm">
                        <div className="font-medium text-foreground">{breach.name}</div>
                        <div className="text-foreground-subtle text-xs mt-0.5">
                          Breach date: {new Date(breach.breachDate).toLocaleDateString()}
                        </div>
                        {breach.dataClasses?.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {breach.dataClasses.slice(0, 4).map((dc, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 bg-background-muted text-foreground-muted rounded">
                                {dc}
                              </span>
                            ))}
                            {breach.dataClasses.length > 4 && (
                              <span className="text-xs px-2 py-0.5 bg-background-muted text-foreground-subtle rounded">
                                +{breach.dataClasses.length - 4} more
                              </span>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h3 className="font-serif text-base font-semibold text-foreground-muted mb-2">What This Means</h3>
                <p className="text-foreground-muted leading-relaxed text-sm">{alertType.explanation}</p>
              </div>

              <div>
                <h3 className="font-serif text-base font-semibold text-foreground-muted mb-3">What to do next</h3>
                <ol className="space-y-2">
                  {alertType.nextSteps.map((step, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                        'bg-primary-subtle text-primary'
                      )}>
                        {index + 1}
                      </span>
                      <span className="text-sm text-foreground-muted pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {relevantReportLinks.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground-muted mb-3">Report This Content</h3>
                  <div className="grid gap-2">
                    {relevantReportLinks.map((link, index) => (
                      <a
                        key={index}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          'flex items-center justify-between p-3 rounded-xl border border-border/40',
                          'bg-card hover:bg-muted transition-colors group'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                            <FileText className="h-4 w-4 text-foreground-muted" />
                          </div>
                          <div>
                            <span className="text-sm font-medium text-foreground block">{link.label}</span>
                            <span className="text-xs text-foreground-subtle">{link.platform}</span>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-foreground-subtle group-hover:text-foreground-muted transition-colors" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {metadata?.relatedAlerts && metadata.relatedAlerts.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground-muted mb-3">Related Alerts</h3>
                  <div className="space-y-2">
                    {metadata.relatedAlerts.map((related) => (
                      <button
                        key={related.id}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-card hover:bg-muted transition-colors text-left"
                      >
                        <AlertTriangle className="h-4 w-4 text-foreground-subtle shrink-0" />
                        <span className="text-sm text-foreground-muted truncate">{related.title}</span>
                        <ChevronRight className="h-4 w-4 text-foreground-subtle ml-auto shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {metadata?.isMock && (
                <div className="rounded-lg bg-primary-subtle border border-primary-muted p-4">
                  <p className="text-sm text-primary">
                    <strong>This is test data</strong> for demonstration purposes. In a real scenario,
                    you would be able to view the actual source and take action.
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-border/40 p-4 pb-20 md:pb-4 bg-background-subtle">
              <div className="flex flex-col items-center gap-3">
                <div className="flex flex-wrap gap-2 w-full">
                  {!metadata?.isMock && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleSaveEvidence}
                      className="flex-1 sm:flex-none"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Save as Evidence
                    </Button>
                  )}

                  {alert.status !== 'ACTIONED' && !metadata?.isMock && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onMarkActioned(alert.id)}
                      disabled={isUpdating}
                      className="flex-1 sm:flex-none"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Mark as Handled
                    </Button>
                  )}

                  {alert.status !== 'DISMISSED' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        onDismiss(alert.id);
                        onClose();
                      }}
                      disabled={isUpdating}
                      className="flex-1 sm:flex-none"
                    >
                      <Archive className="h-4 w-4 mr-1" />
                      Archive
                    </Button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="text-sm text-foreground-muted underline-offset-4 hover:text-foreground hover:underline"
                >
                  Save for later
                </button>

                <div className="flex items-center justify-center gap-2 text-xs text-foreground-muted">
                  {alert.status === 'ACTIONED' && (
                    <>
                      <CheckCircle className="h-3 w-3 text-success" />
                      <span>You marked this as handled</span>
                    </>
                  )}
                  {alert.status === 'DISMISSED' && (
                    <>
                      <Archive className="h-3 w-3 text-foreground-subtle" />
                      <span>This alert has been archived</span>
                    </>
                  )}
                  {alert.status === 'VIEWED' && (
                    <>
                      <Eye className="h-3 w-3 text-info" />
                      <span>Reviewed - awaiting action</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </>
  );
}

export default AlertDetailPanel;
