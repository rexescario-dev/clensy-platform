import { redirect } from 'next/navigation';

// Targets `/app/customers`, the spec's actual final default (spec §4.1) now
// that Customers exists under `/app/*` (Task 6). This redirect is still
// temporary M5-M8 behavior overall — M9 (Operations Dashboard) replaces it
// with real dashboard content — but `/app/customers` is the last handoff
// this milestone needs to make; no later task in this plan changes this
// target again.
export default function AppIndexPage() {
  redirect('/app/customers');
}
