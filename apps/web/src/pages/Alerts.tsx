import { Bell, Construction } from 'lucide-react';

export function Alerts() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-100">
        <Bell className="h-10 w-10 text-primary-600" />
      </div>
      <h1 className="mt-6 text-2xl font-bold text-neutral-900">Alerts</h1>
      <div className="mt-4 flex items-center gap-2 text-neutral-500">
        <Construction className="h-5 w-5" />
        <span>Page Coming Soon</span>
      </div>
      <p className="mt-4 max-w-md text-neutral-600">
        We're building a comprehensive alert system to notify you about potential
        threats, image misuse, and security concerns in real-time.
      </p>
    </div>
  );
}

// Default export for lazy loading
export default Alerts;
