'use client';

import { useCreateServiceMutation, useServicesQuery } from '@clensy/client';
import { Button, DataTable, FormField, StatusBadge } from '@clensy/ui';
import type { DataTableColumn } from '@clensy/ui';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';

import { formatMinorUnits } from './format-price';

// `DataTable<T>` (packages/ui) constrains `T extends Record<string, unknown>`
// — the index signature below satisfies that constraint while keeping the
// named fields concretely typed.
type ServiceRow = {
  id: string;
  name: string;
  durationMinutes: number;
  active: boolean;
  activePricing: { priceMinorUnits: number } | null;
  [key: string]: unknown;
};

export default function CatalogPage() {
  const { data, loading, error, refetch } = useServicesQuery({ fetchPolicy: 'network-only' });
  const [createService, { loading: creating }] = useCreateServiceMutation();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [formError, setFormError] = useState<string | undefined>(undefined);

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    try {
      await createService({
        variables: {
          input: {
            name,
            description: description.trim() === '' ? undefined : description,
            durationMinutes: Number(durationMinutes),
          },
        },
      });
      setName('');
      setDescription('');
      setDurationMinutes('');
      await refetch();
    } catch {
      setFormError('Unable to create service.');
    }
  }

  const columns: DataTableColumn<ServiceRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <Link href={`/catalog/${row.id}`} className="font-medium text-slate-900 underline-offset-2 hover:underline">
          {row.name}
        </Link>
      ),
    },
    {
      key: 'durationMinutes',
      header: 'Duration',
      render: (row) => `${row.durationMinutes} min`,
    },
    {
      key: 'active',
      header: 'Status',
      render: (row) =>
        row.active ? (
          <StatusBadge label="Active" tone="success" />
        ) : (
          <StatusBadge label="Inactive" tone="neutral" />
        ),
    },
    {
      key: 'activePricing',
      header: 'Active price',
      render: (row) => (row.activePricing ? formatMinorUnits(row.activePricing.priceMinorUnits) : '—'),
    },
  ];

  const rows: ServiceRow[] = data?.services ?? [];

  return (
    <main className="flex flex-col gap-8 p-6">
      <h1 className="text-lg font-semibold text-slate-900">Catalog</h1>

      <section>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-600">Unable to load services.</p>
        ) : (
          <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} emptyMessage="No services." />
        )}
      </section>

      <section className="max-w-sm rounded-lg border border-slate-200 p-4">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Add service</h2>
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
          <FormField label="Name" name="new-name" required value={name} onChange={(event) => setName(event.target.value)} />
          <FormField
            label="Description"
            name="new-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <FormField
            label="Duration (minutes)"
            name="new-durationMinutes"
            type="number"
            required
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(event.target.value)}
          />
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          <Button type="submit" disabled={creating}>
            {creating ? 'Creating…' : 'Add service'}
          </Button>
        </form>
      </section>
    </main>
  );
}
