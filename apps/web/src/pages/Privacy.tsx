import { Link } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';

export function Privacy() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary-600" />
            <span className="text-xl font-semibold text-neutral-900">Vara</span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="container py-12 lg:py-20">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold text-neutral-900 sm:text-4xl">Privacy Policy</h1>
          <p className="mt-4 text-neutral-600">Last updated: January 2026</p>

          <div className="mt-8 space-y-8 text-neutral-700">
            <section>
              <h2 className="text-xl font-semibold text-neutral-900">Our Commitment to Privacy</h2>
              <p className="mt-3">
                At Vara, your privacy is not just a feature—it's the foundation of everything we build.
                We are committed to protecting your personal information and being transparent about
                how we collect, use, and safeguard your data.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neutral-900">Information We Collect</h2>
              <p className="mt-3">We collect information that you provide directly to us, including:</p>
              <ul className="mt-3 list-disc space-y-2 pl-6">
                <li>Account information (email, name)</li>
                <li>Photos you choose to protect</li>
                <li>Connected social media account information (with your explicit consent)</li>
                <li>Responses to our safety assessment</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neutral-900">How We Use Your Information</h2>
              <p className="mt-3">We use your information solely to:</p>
              <ul className="mt-3 list-disc space-y-2 pl-6">
                <li>Provide and improve our protection services</li>
                <li>Detect unauthorized use of your images</li>
                <li>Send you alerts about potential threats</li>
                <li>Personalize your protection plan</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neutral-900">What We Never Do</h2>
              <p className="mt-3">We will never:</p>
              <ul className="mt-3 list-disc space-y-2 pl-6">
                <li>Sell your personal data to third parties</li>
                <li>Share your photos without your explicit consent</li>
                <li>Use your data for advertising purposes</li>
                <li>Store more information than necessary</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neutral-900">Data Security</h2>
              <p className="mt-3">
                We employ industry-standard security measures to protect your data, including
                encryption at rest and in transit, secure access controls, and regular security audits.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neutral-900">Your Rights</h2>
              <p className="mt-3">You have the right to:</p>
              <ul className="mt-3 list-disc space-y-2 pl-6">
                <li>Access your personal data</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Export your data</li>
                <li>Withdraw consent at any time</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neutral-900">Contact Us</h2>
              <p className="mt-3">
                If you have any questions about this Privacy Policy or our data practices, please
                contact us at{' '}
                <a
                  href="mailto:privacy@vara.com"
                  className="text-primary-600 hover:text-primary-700 underline"
                >
                  privacy@vara.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white py-8">
        <div className="container text-center text-sm text-neutral-500">
          &copy; {new Date().getFullYear()} Vara. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
