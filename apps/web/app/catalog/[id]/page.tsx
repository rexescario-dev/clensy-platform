'use client';

import { useCreatePricingRuleMutation, useServiceQuery, useUpdateServiceMutation } from '@clensy/client';
import { Button, FormField } from '@clensy/ui';
import { useParams } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { formatMinorUnits, parsePesosToMinorUnits } from '../format-price';

export default function ServiceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data, loading, error, refetch } = useServiceQuery({
    variables: { id },
    fetchPolicy: 'network-only',
  });

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
        <p className="text-sm text-red-600">Unable to load service.</p>
      </main>
    );
  }

  if (!data?.service) {
    return (
      <main className="p-6">
        <p className="text-sm text-slate-700">Service not found.</p>
      </main>
    );
  }

  return <ServiceDetail id={id} service={data.service} refetch={refetch} />;
}

function ServiceDetail({
  id,
  service,
  refetch,
}: {
  id: string;
  service: {
    id: string;
    name: string;
    description: string | null;
    durationMinutes: number;
    active: boolean;
    activePricing: { id: string; priceMinorUnits: number } | null;
  };
  refetch: () => Promise<unknown>;
}) {
  const [updateService, { loading: updatingService }] = useUpdateServiceMutation();
  const [createPricingRule, { loading: settingPrice }] = useCreatePricingRuleMutation();

  // --- Service edit form ---
  const [name, setName] = useState(service.name);
  const [description, setDescription] = useState(service.description ?? '');
  const [durationMinutes, setDurationMinutes] = useState(String(service.durationMinutes));
  const [active, setActive] = useState(service.active);
  const [serviceFormError, setServiceFormError] = useState<string | undefined>(undefined);

  useEffect(() => {
    setName(service.name);
    setDescription(service.description ?? '');
    setDurationMinutes(String(service.durationMinutes));
    setActive(service.active);
  }, [service.name, service.description, service.durationMinutes, service.active]);

  async function handleServiceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServiceFormError(undefined);
    try {
      await updateService({
        variables: {
          id,
          input: {
            name,
            description: description.trim() === '' ? null : description,
            durationMinutes: Number(durationMinutes),
            active,
          },
        },
      });
      await refetch();
    } catch {
      setServiceFormError('Unable to update service.');
    }
  }

  // --- Set new price ---
  const [newPrice, setNewPrice] = useState('');
  const [priceFormError, setPriceFormError] = useState<string | undefined>(undefined);

  async function handlePriceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPriceFormError(undefined);
    let priceMinorUnits: number;
    try {
      priceMinorUnits = parsePesosToMinorUnits(newPrice);
    } catch (parseError) {
      setPriceFormError(parseError instanceof Error ? parseError.message : 'Enter a valid amount, e.g. 19.99');
      return;
    }
    try {
      await createPricingRule({ variables: { input: { serviceId: id, priceMinorUnits } } });
      setNewPrice('');
      await refetch();
    } catch {
      setPriceFormError('Unable to set new price.');
    }
  }

  return (
    <main className="flex flex-col gap-8 p-6">
      <h1 className="text-lg font-semibold text-slate-900">{service.name}</h1>

      <section className="max-w-sm rounded-lg border border-slate-200 p-4">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Service details</h2>
        <form onSubmit={handleServiceSubmit} className="flex flex-col gap-4">
          <FormField label="Name" name="name" required value={name} onChange={(event) => setName(event.target.value)} />
          <FormField
            label="Description"
            name="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <FormField
            label="Duration (minutes)"
            name="durationMinutes"
            type="number"
            required
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(event.target.value)}
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
          {serviceFormError ? <p className="text-sm text-red-600">{serviceFormError}</p> : null}
          <Button type="submit" disabled={updatingService}>
            {updatingService ? 'Saving…' : 'Save service'}
          </Button>
        </form>
      </section>

      <section className="max-w-sm rounded-lg border border-slate-200 p-4">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Pricing</h2>
        <p className="mb-4 text-sm text-slate-700">
          Current active price:{' '}
          {service.activePricing ? formatMinorUnits(service.activePricing.priceMinorUnits) : 'No price set'}
        </p>
        <form onSubmit={handlePriceSubmit} className="flex flex-col gap-4">
          <FormField
            label="New price (₱)"
            name="new-price"
            placeholder="19.99"
            required
            value={newPrice}
            onChange={(event) => setNewPrice(event.target.value)}
          />
          {priceFormError ? <p className="text-sm text-red-600">{priceFormError}</p> : null}
          <Button type="submit" disabled={settingPrice}>
            {settingPrice ? 'Saving…' : 'Set new price'}
          </Button>
        </form>
      </section>
    </main>
  );
}
