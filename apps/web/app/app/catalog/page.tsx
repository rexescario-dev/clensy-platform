'use client';

import {
  useCreatePricingRuleMutation,
  useCreateServiceMutation,
  useServiceQuery,
  useServicesQuery,
  useUpdateServiceMutation,
} from '@clensy/client';
import {
  Button,
  DataTable,
  DetailDrawer,
  ErrorState,
  FormDialog,
  FormField,
  LoadingState,
  PageHeader,
  StatusBadge,
  useToast,
} from '@clensy/ui';
import type { DataTableColumn } from '@clensy/ui';
import { type FormEvent, Suspense, useEffect, useState } from 'react';
import { formatMinorUnits, parsePriceOrReportError } from '../../../lib/format-price';
import { useDetailDrawer } from '../../../lib/use-detail-drawer';

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

type ServiceDetail = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  active: boolean;
  activePricing: { id: string; priceMinorUnits: number } | null;
};

// `useDetailDrawer` reads `useSearchParams()`, which Next.js requires to sit
// under a `<Suspense>` boundary during prerendering (otherwise the whole
// route bails out of static generation with a build-time warning/error).
// The default export supplies that boundary; `CatalogPageContent` holds the
// actual page — list, create dialog, and detail drawer.
export default function CatalogPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <CatalogPageContent />
    </Suspense>
  );
}

function CatalogPageContent() {
  const { data, loading, error, refetch } = useServicesQuery({ fetchPolicy: 'network-only' });
  const [createService, { loading: creating }] = useCreateServiceMutation();
  const { activeId, open: openDetail, close: closeDetail } = useDetailDrawer();

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [formError, setFormError] = useState<string | undefined>(undefined);

  function resetForm() {
    setName('');
    setDescription('');
    setDurationMinutes('');
    setFormError(undefined);
  }

  function openCreateForm() {
    resetForm();
    setFormOpen(true);
  }

  async function handleCreateSubmit() {
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
      setFormOpen(false);
      resetForm();
      await refetch();
    } catch {
      setFormError('Unable to create service.');
    }
  }

  const columns: DataTableColumn<ServiceRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => <span className="font-medium text-slate-900">{row.name}</span>,
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
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Catalog"
        actions={
          <Button type="button" onClick={openCreateForm}>
            + New Service
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        emptyMessage="No services."
        loading={loading}
        error={error ? 'Unable to load services.' : undefined}
        onRowClick={(row) => openDetail(row.id)}
      />

      <FormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Add service"
        onSubmit={handleCreateSubmit}
        submitLabel={creating ? 'Creating…' : 'Add service'}
        submitting={creating}
      >
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
      </FormDialog>

      {activeId ? (
        <ServiceDetailDrawer id={activeId} onClose={closeDetail} onSaved={() => void refetch()} />
      ) : null}
    </div>
  );
}

function ServiceDetailDrawer({
  id,
  onClose,
  onSaved,
}: {
  id: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data, loading, error, refetch } = useServiceQuery({
    variables: { id },
    fetchPolicy: 'network-only',
  });

  const title = data?.service?.name ?? 'Service';

  return (
    <DetailDrawer open onClose={onClose} title={title}>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message="Unable to load service." />
      ) : !data?.service ? (
        <p className="text-sm text-slate-700">Service not found.</p>
      ) : (
        <div className="flex flex-col gap-8">
          <ServiceEditForm service={data.service} refetch={refetch} onSaved={onSaved} />
          <ServicePricing service={data.service} refetch={refetch} onSaved={onSaved} />
        </div>
      )}
    </DetailDrawer>
  );
}

function ServiceEditForm({
  service,
  refetch,
  onSaved,
}: {
  service: ServiceDetail;
  refetch: () => Promise<unknown>;
  onSaved: () => void;
}) {
  const [updateService, { loading: updating }] = useUpdateServiceMutation();
  const { success } = useToast();

  const [name, setName] = useState(service.name);
  const [description, setDescription] = useState(service.description ?? '');
  const [durationMinutes, setDurationMinutes] = useState(String(service.durationMinutes));
  const [active, setActive] = useState(service.active);
  const [formError, setFormError] = useState<string | undefined>(undefined);

  useEffect(() => {
    setName(service.name);
    setDescription(service.description ?? '');
    setDurationMinutes(String(service.durationMinutes));
    setActive(service.active);
  }, [service.name, service.description, service.durationMinutes, service.active]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    try {
      await updateService({
        variables: {
          id: service.id,
          input: {
            name,
            description: description.trim() === '' ? null : description,
            durationMinutes: Number(durationMinutes),
            active,
          },
        },
      });
      await refetch();
      onSaved();
      success('Service updated.');
    } catch {
      setFormError('Unable to update service.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-slate-900">Service details</h3>
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
      {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
      <Button type="submit" disabled={updating}>
        {updating ? 'Saving…' : 'Save service'}
      </Button>
    </form>
  );
}

// Ported from the pre-migration `catalog/[id]/page.tsx`'s "Pricing" section.
// Deliberately append-only: each submission calls `useCreatePricingRuleMutation`
// to create a NEW active `PricingRule` — it is never an update of the
// existing price. Kept as its own always-visible inline section (not a
// nested `FormDialog`) for the same reason `CleanerTeamAssignment` is inline
// in `app/app/cleaners/page.tsx` — there must be exactly one dialog (the
// drawer itself) open at a time.
function ServicePricing({
  service,
  refetch,
  onSaved,
}: {
  service: ServiceDetail;
  refetch: () => Promise<unknown>;
  onSaved: () => void;
}) {
  const [createPricingRule, { loading: settingPrice }] = useCreatePricingRuleMutation();
  const { success } = useToast();

  const [newPrice, setNewPrice] = useState('');
  const [priceFormError, setPriceFormError] = useState<string | undefined>(undefined);

  async function handlePriceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPriceFormError(undefined);
    const priceMinorUnits = parsePriceOrReportError(newPrice, setPriceFormError);
    if (priceMinorUnits === undefined) return;
    try {
      await createPricingRule({ variables: { input: { serviceId: service.id, priceMinorUnits } } });
      setNewPrice('');
      await refetch();
      onSaved();
      success('New price set.');
    } catch {
      setPriceFormError('Unable to set new price.');
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">Pricing</h3>
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
    </div>
  );
}
