'use client';

import { useAddOnsQuery, useCreateAddOnMutation } from '@clensy/client';
import { Button, DataTable, FormField, StatusBadge } from '@clensy/ui';
import type { DataTableColumn } from '@clensy/ui';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';

import { formatMinorUnits, parsePesosToMinorUnits } from '../format-price';

// `DataTable<T>` (packages/ui) constrains `T extends Record<string, unknown>`
// — the index signature below satisfies that constraint while keeping the
// named fields concretely typed.
type AddOnRow = {
  id: string;
  name: string;
  priceMinorUnits: number;
  active: boolean;
  [key: string]: unknown;
};

export default function AddOnsPage() {
  const { data, loading, error, refetch } = useAddOnsQuery({ fetchPolicy: 'network-only' });
  const [createAddOn, { loading: creating }] = useCreateAddOnMutation();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [formError, setFormError] = useState<string | undefined>(undefined);

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    let priceMinorUnits: number;
    try {
      priceMinorUnits = parsePesosToMinorUnits(price);
    } catch (parseError) {
      setFormError(parseError instanceof Error ? parseError.message : 'Enter a valid amount, e.g. 19.99');
      return;
    }
    try {
      await createAddOn({
        variables: {
          input: {
            name,
            description: description.trim() === '' ? undefined : description,
            priceMinorUnits,
          },
        },
      });
      setName('');
      setDescription('');
      setPrice('');
      await refetch();
    } catch {
      setFormError('Unable to create add-on.');
    }
  }

  const columns: DataTableColumn<AddOnRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <Link
          href={`/catalog/add-ons/${row.id}`}
          className="font-medium text-slate-900 underline-offset-2 hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: 'priceMinorUnits',
      header: 'Price',
      render: (row) => formatMinorUnits(row.priceMinorUnits),
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
  ];

  const rows: AddOnRow[] = data?.addOns ?? [];

  return (
    <main className="flex flex-col gap-8 p-6">
      <h1 className="text-lg font-semibold text-slate-900">Add-ons</h1>

      <section>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-600">Unable to load add-ons.</p>
        ) : (
          <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} emptyMessage="No add-ons." />
        )}
      </section>

      <section className="max-w-sm rounded-lg border border-slate-200 p-4">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Add add-on</h2>
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
          <FormField label="Name" name="new-name" required value={name} onChange={(event) => setName(event.target.value)} />
          <FormField
            label="Description"
            name="new-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <FormField
            label="Price (₱)"
            name="new-price"
            placeholder="19.99"
            required
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          <Button type="submit" disabled={creating}>
            {creating ? 'Creating…' : 'Add add-on'}
          </Button>
        </form>
      </section>
    </main>
  );
}
