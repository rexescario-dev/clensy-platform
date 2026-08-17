'use client';

import { useAddOnsQuery, useUpdateAddOnMutation } from '@clensy/client';
import { Button, FormField } from '@clensy/ui';
import { useParams } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { parsePesosToMinorUnits, toEditableAmount } from '../../format-price';

// There is no standalone `addOn(id)` GraphQL query (only `addOns`, the full
// list — see task-6-brief.md). This page fetches the full list via
// `useAddOnsQuery` and finds its row client-side by matching `id` from the
// route params, the only spec-authorized way to reach a single add-on.
export default function AddOnDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data, loading, error, refetch } = useAddOnsQuery({ fetchPolicy: 'network-only' });

  if (loading) {
    return (
      <main className="p-6">
        <p className="text-sm text-slate-500">Loading…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="p-6">
        <p className="text-sm text-red-600">Unable to load add-on.</p>
      </main>
    );
  }

  const addOn = data?.addOns.find((candidate) => candidate.id === id);

  if (!addOn) {
    return (
      <main className="p-6">
        <p className="text-sm text-slate-700">Add-on not found.</p>
      </main>
    );
  }

  return <AddOnDetail id={id} addOn={addOn} refetch={refetch} />;
}

function AddOnDetail({
  id,
  addOn,
  refetch,
}: {
  id: string;
  addOn: {
    id: string;
    name: string;
    description: string | null;
    priceMinorUnits: number;
    active: boolean;
  };
  refetch: () => Promise<unknown>;
}) {
  const [updateAddOn, { loading: updating }] = useUpdateAddOnMutation();

  const [name, setName] = useState(addOn.name);
  const [description, setDescription] = useState(addOn.description ?? '');
  const [active, setActive] = useState(addOn.active);
  const [price, setPrice] = useState(toEditableAmount(addOn.priceMinorUnits));
  const [formError, setFormError] = useState<string | undefined>(undefined);

  useEffect(() => {
    setName(addOn.name);
    setDescription(addOn.description ?? '');
    setActive(addOn.active);
    setPrice(toEditableAmount(addOn.priceMinorUnits));
  }, [addOn.name, addOn.description, addOn.active, addOn.priceMinorUnits]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
      await updateAddOn({
        variables: {
          id,
          input: {
            name,
            description: description.trim() === '' ? null : description,
            active,
            priceMinorUnits,
          },
        },
      });
      await refetch();
    } catch {
      setFormError('Unable to update add-on.');
    }
  }

  return (
    <main className="flex flex-col gap-8 p-6">
      <h1 className="text-lg font-semibold text-slate-900">{addOn.name}</h1>

      <section className="max-w-sm rounded-lg border border-slate-200 p-4">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Add-on details</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField label="Name" name="name" required value={name} onChange={(event) => setName(event.target.value)} />
          <FormField
            label="Description"
            name="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <FormField
            label="Price (₱)"
            name="price"
            placeholder="19.99"
            required
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
          <div className="flex flex-col gap-1">
            <label htmlFor="active-select" className="text-sm font-medium text-slate-700">
              Status
            </label>
            <select
              id="active-select"
              name="active-select"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              value={active ? 'active' : 'inactive'}
              onChange={(event) => setActive(event.target.value === 'active')}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          <Button type="submit" disabled={updating}>
            {updating ? 'Saving…' : 'Save add-on'}
          </Button>
        </form>
      </section>
    </main>
  );
}
