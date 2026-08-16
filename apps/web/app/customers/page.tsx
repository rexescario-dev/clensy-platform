'use client';

import { useCreateCustomerMutation, useCustomersQuery } from '@clensy/client';
import { Button, DataTable, FormField } from '@clensy/ui';
import type { DataTableColumn } from '@clensy/ui';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';

// `DataTable<T>` (packages/ui) constrains `T extends Record<string, unknown>`
// — the index signature below satisfies that constraint while keeping the
// named fields concretely typed.
type CustomerRow = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  [key: string]: unknown;
};

export default function CustomersPage() {
  const { data, loading, error, refetch } = useCustomersQuery({ fetchPolicy: 'network-only' });
  const [createCustomer, { loading: creating }] = useCreateCustomerMutation();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | undefined>(undefined);

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    try {
      await createCustomer({
        variables: {
          input: {
            fullName,
            email,
            phone,
            notes: notes.trim() === '' ? undefined : notes,
          },
        },
      });
      setFullName('');
      setEmail('');
      setPhone('');
      setNotes('');
      await refetch();
    } catch {
      setFormError('Unable to create customer.');
    }
  }

  const columns: DataTableColumn<CustomerRow>[] = [
    {
      key: 'fullName',
      header: 'Name',
      render: (row) => (
        <Link href={`/customers/${row.id}`} className="font-medium text-slate-900 underline-offset-2 hover:underline">
          {row.fullName}
        </Link>
      ),
    },
    { key: 'email', header: 'Email' },
    { key: 'phone', header: 'Phone' },
  ];

  const rows: CustomerRow[] = data?.customers ?? [];

  return (
    <main className="flex flex-col gap-8 p-6">
      <h1 className="text-lg font-semibold text-slate-900">Customers</h1>

      <section>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-600">Unable to load customers.</p>
        ) : (
          <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} emptyMessage="No customers." />
        )}
      </section>

      <section className="max-w-sm rounded-lg border border-slate-200 p-4">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Add customer</h2>
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
          <FormField
            label="Full name"
            name="new-fullName"
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
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
            label="Phone"
            name="new-phone"
            required
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
          <FormField
            label="Notes"
            name="new-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          <Button type="submit" disabled={creating}>
            {creating ? 'Creating…' : 'Add customer'}
          </Button>
        </form>
      </section>
    </main>
  );
}
