'use client';

import {
  Role,
  useAdminsQuery,
  useCreateAdminMutation,
  useCurrentAdminQuery,
  useDisableAdminMutation,
} from '@clensy/client';
import { Button, DataTable, FormField, StatusBadge } from '@clensy/ui';
import type { DataTableColumn } from '@clensy/ui';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

const ROLE_OPTIONS: Role[] = ['OWNER', 'OPS_MANAGER', 'FINANCE', 'CUSTOMER_SUPPORT', 'SCHEDULER', 'ANALYST'];

// `DataTable<T>` (packages/ui) constrains `T extends Record<string, unknown>`
// — the index signature below satisfies that constraint while keeping the
// named fields concretely typed.
type AdminRow = {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  [key: string]: unknown;
};

// Spec §4.5/§3: `middleware.ts` only checked whether the session cookie is
// present, not whether it's still valid — an expired, invalid, or
// disabled-account session sails past middleware and lands here. This page
// is where that actually gets caught: `currentAdmin` is guarded on the API
// side (`AuthGuard`), so an invalid session surfaces as a GraphQL error (or,
// defensively, a missing `currentAdmin` in the response) rather than a
// success. Either case sends the user back to `/login`. The `role !==
// OWNER` branch below is a UX nicety only — the API independently enforces
// Owner-only access on `admins`/`createAdmin`/`disableAdmin` regardless of
// what this page renders.
export default function AdminPage() {
  const router = useRouter();
  const { data: meData, loading: meLoading, error: meError } = useCurrentAdminQuery({
    fetchPolicy: 'network-only',
  });

  const isAuthenticated = !meLoading && !meError && Boolean(meData?.currentAdmin);
  const isOwner = isAuthenticated && meData?.currentAdmin?.role === 'OWNER';

  useEffect(() => {
    if (!meLoading && (meError || !meData?.currentAdmin)) {
      router.replace('/login');
    }
  }, [meLoading, meError, meData, router]);

  if (meLoading) {
    return (
      <main className="p-6">
        <p className="text-sm text-slate-500">Loading…</p>
      </main>
    );
  }

  if (!isAuthenticated) {
    // Redirect already dispatched in the effect above; render nothing while
    // it takes effect.
    return null;
  }

  if (!isOwner) {
    return (
      <main className="p-6">
        <p className="text-sm text-slate-700">You are not authorized to view this page.</p>
      </main>
    );
  }

  return <OwnerAdminConsole />;
}

function OwnerAdminConsole() {
  const { data, loading, error, refetch } = useAdminsQuery({ fetchPolicy: 'network-only' });
  const [createAdmin, { loading: creating }] = useCreateAdminMutation();
  const [disableAdmin, { loading: disabling }] = useDisableAdminMutation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('CUSTOMER_SUPPORT');
  const [formError, setFormError] = useState<string | undefined>(undefined);

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    try {
      await createAdmin({ variables: { createAdminInput: { email, password, role } } });
      setEmail('');
      setPassword('');
      setRole('CUSTOMER_SUPPORT');
      await refetch();
    } catch {
      setFormError('Unable to create staff account.');
    }
  }

  async function handleDisable(id: string) {
    await disableAdmin({ variables: { id } });
    await refetch();
  }

  const columns: DataTableColumn<AdminRow>[] = [
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role' },
    {
      key: 'status',
      header: 'Status',
      render: (row) =>
        row.isActive ? (
          <StatusBadge label="Active" tone="success" />
        ) : (
          <StatusBadge label="Disabled" tone="danger" />
        ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        row.isActive ? (
          <Button variant="danger" disabled={disabling} onClick={() => handleDisable(row.id)}>
            Disable
          </Button>
        ) : null,
    },
  ];

  const rows: AdminRow[] = data?.admins ?? [];

  return (
    <main className="flex flex-col gap-8 p-6">
      <h1 className="text-lg font-semibold text-slate-900">Staff Accounts</h1>

      <section>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-600">Unable to load staff accounts.</p>
        ) : (
          <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} emptyMessage="No staff accounts." />
        )}
      </section>

      <section className="max-w-sm rounded-lg border border-slate-200 p-4">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Add staff account</h2>
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
          <FormField
            label="Email"
            name="new-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <FormField
            label="Password"
            name="new-password"
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <div className="flex flex-col gap-1">
            <label htmlFor="new-role" className="text-sm font-medium text-slate-700">
              Role
            </label>
            <select
              id="new-role"
              name="new-role"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          <Button type="submit" disabled={creating}>
            {creating ? 'Creating…' : 'Create staff account'}
          </Button>
        </form>
      </section>
    </main>
  );
}
