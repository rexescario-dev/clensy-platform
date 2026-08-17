import { redirect } from 'next/navigation';

// Temporarily targets `/app/admin` — Admin is the only module Task 5
// migrates. Task 6 changes this destination to `/app/customers` once
// Customers exists under `/app/*`, matching the spec's final `/app` ->
// `/app/customers` default (spec §4.1). This keeps `/app` never pointing at
// a route that doesn't exist yet on `main` at any commit.
export default function AppIndexPage() {
  redirect('/app/admin'); // Task 6 changes this to '/app/customers'
}
