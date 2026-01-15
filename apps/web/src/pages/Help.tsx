import { useState } from 'react';
import {
  HelpCircle,
  Shield,
  Phone,
  Mail,
  ChevronDown,
  ExternalLink,
  Heart,
  AlertTriangle,
  Lock,
  User,
  Image,
  Bell,
  FileText,
  MessageCircle,
} from 'lucide-react';
import { cn } from '../lib/cn';

// FAQ data structure
interface FAQItem {
  question: string;
  answer: string;
  icon: React.ElementType;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    question: 'How does image protection work?',
    answer:
      'When you upload photos to Vara, we create a unique digital fingerprint (embedding) of each image. Our system continuously scans the web to find any unauthorized copies or modifications of your protected images. If we detect a match, you will receive an alert with details about where your image was found and recommended next steps.',
    icon: Image,
  },
  {
    question: 'What should I do when I get an alert?',
    answer:
      'First, stay calm - we are here to help. Review the alert details to understand what was detected. Each alert includes a severity level, plain-language explanation, and specific recommended actions. You can choose to dismiss false positives, report the content to the platform, or escalate to additional resources if needed. Your Protection Plan will update based on the actions you take.',
    icon: Bell,
  },
  {
    question: 'How is my data kept private and secure?',
    answer:
      'Your privacy is our top priority. All sensitive data is encrypted at rest and in transit. We never sell or share your personal information. Your images are stored securely with non-guessable URLs, and you have full control over what we monitor. You can delete your data at any time, and we follow strict data retention policies aligned with GDPR and CCPA requirements.',
    icon: Lock,
  },
  {
    question: 'How do I manage my account settings?',
    answer:
      'Visit the Settings page to manage your account preferences, notification settings, connected social accounts, and privacy options. You can update your display name, change your email preferences, disconnect social accounts, or delete your account entirely if needed.',
    icon: User,
  },
  {
    question: 'What platforms does Vara monitor?',
    answer:
      'Vara monitors a wide range of platforms where image misuse commonly occurs, including major social media networks, image sharing sites, and adult content platforms. Our scanning technology continuously expands to cover new platforms. When you connect your social accounts (like Instagram, TikTok, or Facebook), we can also detect fake profiles impersonating you.',
    icon: Shield,
  },
  {
    question: 'How accurate is the deepfake detection?',
    answer:
      'Our deepfake detection uses advanced AI to identify manipulated images and videos with high accuracy. While no system is perfect, we continuously improve our detection capabilities. When a potential deepfake is detected, we provide a confidence score and let you review the finding. False positives can be dismissed, helping our system learn and improve.',
    icon: AlertTriangle,
  },
];

// Safety resources data
interface ResourceCategory {
  title: string;
  description: string;
  resources: {
    name: string;
    url: string;
    description: string;
  }[];
}

const SAFETY_RESOURCES: ResourceCategory[] = [
  {
    title: 'Online Harassment',
    description: 'Resources for dealing with cyberbullying, trolling, and online abuse',
    resources: [
      {
        name: 'Cyber Civil Rights Initiative',
        url: 'https://cybercivilrights.org',
        description: 'Support for victims of non-consensual pornography and online abuse',
      },
      {
        name: 'HeartMob',
        url: 'https://iheartmob.org',
        description: 'Real-time support for people experiencing online harassment',
      },
      {
        name: 'Online SOS',
        url: 'https://onlinesos.org',
        description: 'Free resources and support for online harassment victims',
      },
    ],
  },
  {
    title: 'Image-Based Abuse',
    description: 'Help for intimate image abuse, revenge porn, and unauthorized image sharing',
    resources: [
      {
        name: 'StopNCII.org',
        url: 'https://stopncii.org',
        description: 'Free tool to help stop the spread of intimate images',
      },
      {
        name: 'CCRI Image Abuse Helpline',
        url: 'https://cybercivilrights.org/ccri-crisis-helpline',
        description: '24/7 crisis helpline for image abuse victims',
      },
      {
        name: 'Without My Consent',
        url: 'https://withoutmyconsent.org',
        description: 'Legal resources and support for image-based sexual abuse',
      },
    ],
  },
  {
    title: 'Stalking & Tracking',
    description: 'Resources for digital stalking, location tracking, and surveillance',
    resources: [
      {
        name: 'Stalking Prevention Center',
        url: 'https://www.stalkingawareness.org',
        description: 'Information and resources for stalking victims',
      },
      {
        name: 'Safety Net',
        url: 'https://www.techsafety.org',
        description: 'Tech safety resources from the National Network to End Domestic Violence',
      },
      {
        name: 'Coalition Against Stalkerware',
        url: 'https://stopstalkerware.org',
        description: 'Resources for detecting and removing stalkerware from devices',
      },
    ],
  },
  {
    title: 'Domestic Violence & Tech Safety',
    description: 'Technology safety for survivors of domestic violence',
    resources: [
      {
        name: 'Tech Safety App',
        url: 'https://www.techsafety.org/resources-survivors',
        description: 'Comprehensive tech safety planning resources',
      },
      {
        name: 'WomensLaw.org',
        url: 'https://www.womenslaw.org',
        description: 'Legal information for survivors of abuse',
      },
      {
        name: 'National Domestic Violence Hotline',
        url: 'https://www.thehotline.org',
        description: '24/7 confidential support and resources',
      },
    ],
  },
];

// Emergency contacts
const EMERGENCY_CONTACTS = [
  {
    name: 'National Domestic Violence Hotline',
    phone: '1-800-799-7233',
    description: '24/7 confidential support for domestic violence survivors',
    available: '24 hours, 7 days a week',
  },
  {
    name: 'Crisis Text Line',
    phone: 'Text HOME to 741741',
    description: 'Free crisis support via text message',
    available: '24 hours, 7 days a week',
  },
  {
    name: 'RAINN (Sexual Assault Hotline)',
    phone: '1-800-656-4673',
    description: 'Support for survivors of sexual violence',
    available: '24 hours, 7 days a week',
  },
];

/**
 * Accordion component for FAQ items
 */
function FAQAccordion({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  const Icon = item.icon;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={onToggle}
        className={cn(
          'flex w-full items-center gap-4 p-4 text-left transition-colors',
          'hover:bg-muted',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset'
        )}
        aria-expanded={isOpen}
      >
        <div
          className={cn(
            'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors',
            isOpen ? 'bg-primary-subtle' : 'bg-muted'
          )}
        >
          <Icon className={cn('h-5 w-5', isOpen ? 'text-primary' : 'text-foreground-subtle')} />
        </div>
        <span className="flex-1 font-medium text-foreground">{item.question}</span>
        <ChevronDown
          className={cn(
            'h-5 w-5 flex-shrink-0 text-foreground-subtle transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>
      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="px-4 pb-4 pl-18">
          <p className="text-foreground-muted leading-relaxed ml-14">{item.answer}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Help & Resources page - provides users with FAQs, safety resources,
 * emergency contacts, and support information.
 */
export function Help() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(0);

  const toggleFAQ = (index: number) => {
    setOpenFAQ(openFAQ === index ? null : index);
  };

  return (
    <div className="space-y-8 sm:space-y-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Help & Resources</h1>
          <p className="mt-1 text-foreground-muted">
            Find answers, resources, and support when you need it
          </p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-subtle">
          <HelpCircle className="h-6 w-6 text-primary" />
        </div>
      </div>

      {/* Emergency Resources - Prominent but not alarming */}
      <section className="rounded-2xl bg-gradient-to-r from-lavender-50 to-lavender-100 border border-lavender-200 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-lavender-100">
            <Heart className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-primary">
              You Are Not Alone
            </h2>
            <p className="mt-1 text-primary">
              If you are in immediate danger, please call 911. These confidential resources are available 24/7.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EMERGENCY_CONTACTS.map((contact) => (
            <div
              key={contact.name}
              className="rounded-xl bg-card/80 p-4 border border-lavender-100"
            >
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-foreground">{contact.name}</h3>
                  <p className="mt-1 text-lg font-semibold text-primary">{contact.phone}</p>
                  <p className="mt-1 text-sm text-foreground-muted">{contact.description}</p>
                  <p className="mt-1 text-xs text-foreground-subtle">{contact.available}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-lavender-200">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-primary">
                <strong>Law Enforcement Guidance:</strong> If you need to report a crime, contact your local police department.
                Vara can provide documentation of detected threats to support your report.
                Many jurisdictions have laws specifically addressing cyberstalking, harassment, and non-consensual image sharing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQs Section */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-subtle">
            <HelpCircle className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Frequently Asked Questions</h2>
            <p className="text-sm text-foreground-muted">Quick answers to common questions</p>
          </div>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, index) => (
            <FAQAccordion
              key={index}
              item={item}
              isOpen={openFAQ === index}
              onToggle={() => toggleFAQ(index)}
            />
          ))}
        </div>
      </section>

      {/* Safety Resources Section */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-subtle">
            <Shield className="h-5 w-5 text-success" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Safety Resources</h2>
            <p className="text-sm text-foreground-muted">Expert organizations and support services</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {SAFETY_RESOURCES.map((category) => (
            <div
              key={category.title}
              className="rounded-xl border border-border bg-card p-5"
            >
              <h3 className="font-semibold text-foreground">{category.title}</h3>
              <p className="mt-1 text-sm text-foreground-muted">{category.description}</p>

              <ul className="mt-4 space-y-3">
                {category.resources.map((resource) => (
                  <li key={resource.name}>
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        'group flex items-start gap-3 rounded-lg p-3 -mx-3 transition-colors',
                        'hover:bg-muted'
                      )}
                    >
                      <ExternalLink className="h-4 w-4 text-foreground-subtle mt-0.5 flex-shrink-0 group-hover:text-primary" />
                      <div>
                        <span className="font-medium text-foreground group-hover:text-primary">
                          {resource.name}
                        </span>
                        <p className="text-sm text-foreground-subtle">{resource.description}</p>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Contact Us Section */}
      <section className="rounded-2xl bg-muted border border-border p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-card">
            <MessageCircle className="h-5 w-5 text-foreground-muted" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Contact Us</h2>
            <p className="text-sm text-foreground-muted">Our support team is here to help</p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl bg-card border border-border p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-subtle">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-foreground">Email Support</h3>
                <a
                  href="mailto:support@vara.com"
                  className="mt-1 text-primary hover:text-primary-hover font-medium"
                >
                  support@vara.com
                </a>
                <p className="mt-2 text-sm text-foreground-muted">
                  We typically respond within 24-48 hours during business days.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-card border border-border p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning-subtle">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <h3 className="font-medium text-foreground">Urgent Safety Concerns</h3>
                <a
                  href="mailto:urgent@vara.com"
                  className="mt-1 text-warning hover:text-warning-hover font-medium"
                >
                  urgent@vara.com
                </a>
                <p className="mt-2 text-sm text-foreground-muted">
                  For time-sensitive safety issues. Our team monitors this inbox closely.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-border">
          <p className="text-sm text-foreground-subtle">
            Before contacting support, please check our FAQ section above - you might find your answer there.
            When reaching out, include as much detail as possible about your issue so we can help you faster.
          </p>
        </div>
      </section>

      {/* Supportive footer message */}
      <div className="text-center py-6">
        <p className="text-foreground-muted">
          Remember: Your safety matters, and taking steps to protect yourself online is a sign of strength.
        </p>
        <p className="mt-2 text-sm text-foreground-subtle">
          Vara is committed to supporting you every step of the way.
        </p>
      </div>
    </div>
  );
}

// Default export for lazy loading
export default Help;
