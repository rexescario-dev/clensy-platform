'use client';

import { useCleanersQuery, useCreateCleanerMutation } from '@clensy/client';
import { Button, DataTable, FormField } from '@clensy/ui';
import type { DataTableColumn } from '@clensy/ui';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';

// `DataTable<T>` (packages/ui) constrains `T extends Record<string, unknown>`
// — the index signature below satisfies that constraint while keeping the
// named fields concretely typed.
type CleanerRow = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  team: { id: string; name: string } | null;
  [key: string]: unknown;
};

export default function CleanersPage() {
  const { data, loading, error, refetch } = useCleanersQuery({ fetchPolicy: 'network-only' });
  const [createCleaner, { loading: creating }] = useCreateCleanerMutation();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | undefined>(undefined);

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    try {
      await createCleaner({
        variables: {
          input: {
            fullName,
            phone,
            email,
            notes: notes.trim() === '' ? undefined : notes,
          },
        },
      });
      setFullName('');
      setPhone('');
      setEmail('');
      setNotes('');
      await refetch();
    } catch {
      setFormError('Unable to create cleaner.');
    }
  }

  const columns: DataTableColumn<CleanerRow>[] = [
    {
      key: 'fullName',
      header: 'Name',
      render: (row) => (
        <Link href={`/cleaners/${row.id}`} className="font-medium text-slate-900 underline-offset-2 hover:underline">
          {row.fullName}
        </Link>
      ),
    },
    { key: 'phone', header: 'Phone' },
    { key: 'email', header: 'Email' },
    {
      key: 'team',
      header: 'Team',
      render: (row) => row.team?.name ?? '—',
    },
  ];

  const rows: CleanerRow[] = data?.cleaners ?? [];

  return (
    <main className="flex flex-col gap-8 p-6">
      <h1 className="text-lg font-semibold text-slate-900">Cleaners</h1>

      <section>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-600">Unable to load cleaners.</p>
        ) : (
          <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} emptyMessage="No cleaners." />
        )}
      </section>

      <section className="max-w-sm rounded-lg border border-slate-200 p-4">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Add cleaner</h2>
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
          <FormField
            label="Full name"
            name="new-fullName"
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
          <FormField
            label="Phone"
            name="new-phone"
            required
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
          <FormField
            label="Email"
            name="new-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <FormField
            label="Notes"
            name="new-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          <Button type="submit" disabled={creating}>
            {creating ? 'Creating…' : 'Add cleaner'}
          </Button>
        </form>
      </section>
    </main>
  );
}
