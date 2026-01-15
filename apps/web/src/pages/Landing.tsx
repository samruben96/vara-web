import { Link } from 'react-router-dom';
import { Shield, Eye, Bell, Lock, ChevronRight, CheckCircle } from 'lucide-react';
import { Button } from '../components/ui';

export function Landing() {
  const features = [
    {
      icon: Eye,
      title: 'Image Protection',
      description:
        'Detect unauthorized use of your photos across the web, including deepfakes and modified images.',
    },
    {
      icon: Bell,
      title: 'Real-time Alerts',
      description:
        'Get notified immediately when we detect potential threats, with clear guidance on what to do.',
    },
    {
      icon: Lock,
      title: 'Privacy-First',
      description:
        'Your data stays yours. We never sell or share your information. All scanning is opt-in.',
    },
    {
      icon: Shield,
      title: 'Personal Protection Plan',
      description:
        'Receive a customized safety plan based on your unique digital footprint and risk profile.',
    },
  ];

  const benefits = [
    'Detect fake profiles using your photos',
    'Monitor for deepfake creation',
    'Track unauthorized image sharing',
    'Check for data breaches',
    'Analyze suspicious followers',
    'Get actionable safety recommendations',
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            <span className="text-xl font-semibold text-foreground">Vara</span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-sm font-medium text-foreground-muted hover:text-foreground">
              Features
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-foreground-muted hover:text-foreground">
              How it Works
            </a>
            <Link to="/login" className="text-sm font-medium text-foreground-muted hover:text-foreground">
              Log in
            </Link>
            <Link to="/signup">
              <Button size="sm">Get Started</Button>
            </Link>
          </nav>

          <div className="flex items-center gap-4 md:hidden">
            <Link to="/login" className="text-sm font-medium text-foreground-muted hover:text-foreground">
              Log in
            </Link>
            <Link to="/signup">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary-subtle to-card py-20 lg:py-32">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Digital safety designed{' '}
              <span className="gradient-text">for women</span>
            </h1>
            <p className="mt-6 text-lg text-foreground-muted sm:text-xl">
              Protect yourself from online harassment, stalking, impersonation, and image misuse.
              Take control of your digital presence with comprehensive, privacy-first protection.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link to="/signup">
                <Button size="lg" className="w-full sm:w-auto">
                  Start Free Protection
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                  Learn More
                </Button>
              </a>
            </div>
            <p className="mt-4 text-sm text-foreground-subtle">
              Free to start. No credit card required.
            </p>
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute -top-40 right-0 -z-10 h-[500px] w-[500px] rounded-full bg-primary-subtle opacity-50 blur-3xl" />
        <div className="absolute -bottom-40 left-0 -z-10 h-[400px] w-[400px] rounded-full bg-primary-subtle opacity-50 blur-3xl" />
      </section>

      {/* Features */}
      <section id="features" className="py-20 lg:py-32">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Comprehensive protection, zero complexity
            </h2>
            <p className="mt-4 text-lg text-foreground-muted">
              We handle the technical complexity so you can focus on living your life with confidence.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div key={feature.title} className="card">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-subtle">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-foreground-muted">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="bg-muted py-20 lg:py-32">
        <div className="container">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Your safety, your way
              </h2>
              <p className="mt-4 text-lg text-foreground-muted">
                Complete a quick assessment, and we'll create a personalized protection plan
                tailored to your unique digital footprint and risk profile.
              </p>
              <ul className="mt-8 space-y-4">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 flex-shrink-0 text-success" />
                    <span className="text-foreground">{benefit}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-10">
                <Link to="/signup">
                  <Button size="lg">
                    Get Your Protection Plan
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="card">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                      1
                    </div>
                    <span className="font-medium text-foreground">Create your account</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                      2
                    </div>
                    <span className="font-medium text-foreground">Complete safety assessment</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                      3
                    </div>
                    <span className="font-medium text-foreground">Upload photos to protect</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                      4
                    </div>
                    <span className="font-medium text-foreground">Review your Protection Plan</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 lg:py-32">
        <div className="container">
          <div className="mx-auto max-w-3xl rounded-2xl bg-gradient-to-r from-primary to-primary-hover px-8 py-16 text-center shadow-xl sm:px-16">
            <h2 className="text-3xl font-bold text-primary-foreground sm:text-4xl">
              Ready to take control of your digital safety?
            </h2>
            <p className="mt-4 text-lg text-primary-foreground/80">
              Join thousands of women who trust Vara to protect their online presence.
            </p>
            <div className="mt-8">
              <Link to="/signup">
                <Button
                  variant="secondary"
                  size="lg"
                  className="bg-card text-primary hover:bg-primary-subtle"
                >
                  Get Started Free
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-12">
        <div className="container">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <span className="font-semibold text-foreground">Vara</span>
            </div>
            <nav className="flex flex-wrap justify-center gap-6">
              <Link to="/privacy" className="text-sm text-foreground-muted hover:text-foreground">
                Privacy Policy
              </Link>
              <Link to="/terms" className="text-sm text-foreground-muted hover:text-foreground">
                Terms of Service
              </Link>
              <a
                href="mailto:support@vara.com"
                className="text-sm text-foreground-muted hover:text-foreground"
              >
                Contact
              </a>
            </nav>
            <p className="text-sm text-foreground-subtle">
              &copy; {new Date().getFullYear()} Vara. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
