import { Link } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';

export function Terms() {
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
          <h1 className="text-3xl font-bold text-neutral-900 sm:text-4xl">Terms of Service</h1>
          <p className="mt-4 text-neutral-600">Last updated: January 2026</p>

          <div className="mt-8 space-y-8 text-neutral-700">
            <section>
              <h2 className="text-xl font-semibold text-neutral-900">Welcome to Vara</h2>
              <p className="mt-3">
                These Terms of Service govern your use of Vara's digital safety platform. By using
                our services, you agree to these terms. Please read them carefully.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neutral-900">Our Services</h2>
              <p className="mt-3">
                Vara provides digital safety tools designed to help protect you from online
                harassment, image misuse, and privacy violations. Our services include:
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-6">
                <li>Image protection and monitoring</li>
                <li>Fake profile and impersonation detection</li>
                <li>Data breach monitoring</li>
                <li>Personalized protection plans</li>
                <li>Safety alerts and recommendations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neutral-900">Your Account</h2>
              <p className="mt-3">
                You are responsible for maintaining the security of your account and password.
                Vara cannot and will not be liable for any loss or damage from your failure to
                comply with this security obligation.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neutral-900">Acceptable Use</h2>
              <p className="mt-3">You agree to use Vara only for lawful purposes. You may not:</p>
              <ul className="mt-3 list-disc space-y-2 pl-6">
                <li>Use the service to harass, abuse, or harm others</li>
                <li>Upload content that violates others' rights</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Use the service for any illegal activity</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neutral-900">Your Content</h2>
              <p className="mt-3">
                You retain ownership of any photos and content you upload to Vara. By uploading
                content, you grant us a limited license to process and scan your content solely
                for the purpose of providing our protection services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neutral-900">Limitations</h2>
              <p className="mt-3">
                While we strive to provide comprehensive protection, we cannot guarantee the
                detection of all threats. Our service is a tool to help enhance your digital
                safety, not a complete solution to all online risks.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neutral-900">Termination</h2>
              <p className="mt-3">
                You may terminate your account at any time. Upon termination, we will delete your
                personal data in accordance with our Privacy Policy. We reserve the right to
                suspend or terminate accounts that violate these terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neutral-900">Changes to Terms</h2>
              <p className="mt-3">
                We may update these terms from time to time. We will notify you of significant
                changes via email or through the service. Continued use after changes constitutes
                acceptance of the new terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neutral-900">Contact Us</h2>
              <p className="mt-3">
                If you have any questions about these Terms of Service, please contact us at{' '}
                <a
                  href="mailto:legal@vara.com"
                  className="text-primary-600 hover:text-primary-700 underline"
                >
                  legal@vara.com
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
