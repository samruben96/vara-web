import { Link } from 'react-router-dom';
import { Shield, Heart, Lock, Clock } from 'lucide-react';
import { Button } from '../../components/ui';

/**
 * Welcome screen before the onboarding quiz
 * Sets expectations and provides reassurance
 */
export function Welcome() {
  return (
    <div className="animate-fade-in space-y-8 text-center">
      {/* Hero section */}
      <div className="space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100">
          <Shield className="h-8 w-8 text-primary-600" />
        </div>
        <h1 className="text-3xl font-bold text-neutral-900 sm:text-4xl">
          Let's create your safety plan
        </h1>
        <p className="mx-auto max-w-md text-lg text-neutral-600">
          Answer a few questions to help us understand your needs and build a
          personalized protection plan just for you.
        </p>
      </div>

      {/* What to expect cards */}
      <div className="mx-auto max-w-sm space-y-3">
        <div className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100">
            <Clock className="h-5 w-5 text-primary-600" />
          </div>
          <div className="text-left">
            <p className="font-medium text-neutral-900">Takes about 3 minutes</p>
            <p className="text-sm text-neutral-500">
              8 simple questions about your needs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success-100">
            <Lock className="h-5 w-5 text-success-600" />
          </div>
          <div className="text-left">
            <p className="font-medium text-neutral-900">Completely private</p>
            <p className="text-sm text-neutral-500">
              Your answers stay confidential
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning-100">
            <Heart className="h-5 w-5 text-warning-600" />
          </div>
          <div className="text-left">
            <p className="font-medium text-neutral-900">No judgment here</p>
            <p className="text-sm text-neutral-500">
              We're here to support you, always
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="space-y-4 pt-4">
        <Link to="/onboarding/quiz">
          <Button size="lg" className="w-full sm:w-auto sm:px-12">
            Get started
          </Button>
        </Link>
        <p className="text-sm text-neutral-500">
          You can skip questions or update your answers later
        </p>
      </div>
    </div>
  );
}
