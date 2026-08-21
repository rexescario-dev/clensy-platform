'use client';

import { useAddOnsQuery, useCreateAddOnMutation, useUpdateAddOnMutation } from '@clensy/client';
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
import { parsePriceOrReportError, formatMinorUnits, toEditableAmount } from '../../../../lib/format-price';
import { useDetailDrawer } from '../../../../lib/use-detail-drawer';

// `DataTable<T>` (packages/ui) constrains `T extends Record<string, unknown>`
// — the index signature below satisfies that constraint while keeping the
// named fields concretely typed.
type AddOnRow = {
  id: string;
  name: string;
  description: string | null;
  priceMinorUnits: number;
  active: boolean;
  [key: string]: unknown;
};

type AddOnDetail = {
  id: string;
  name: string;
  description: string | null;
  priceMinorUnits: number;
  active: boolean;
};

// `useDetailDrawer` reads `useSearchParams()`, which Next.js requires to sit
// under a `<Suspense>` boundary during prerendering (otherwise the whole
// route bails out of static generation with a build-time warning/error).
// The default export supplies that boundary; `AddOnsPageContent` holds the
// actual page — list, create dialog, and detail drawer.
export default function AddOnsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AddOnsPageContent />
    </Suspense>
  );
}

function AddOnsPageContent() {
  const { data, loading, error, refetch } = useAddOnsQuery({ fetchPolicy: 'network-only' });
  const [createAddOn, { loading: creating }] = useCreateAddOnMutation();
  const { activeId, open: openDetail, close: closeDetail } = useDetailDrawer();

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [formError, setFormError] = useState<string | undefined>(undefined);

  function resetForm() {
    setName('');
    setDescription('');
    setPrice('');
    setFormError(undefined);
  }

  function openCreateForm() {
    resetForm();
    setFormOpen(true);
  }

  async function handleCreateSubmit() {
    setFormError(undefined);
    const priceMinorUnits = parsePriceOrReportError(price, setFormError);
    if (priceMinorUnits === undefined) return;
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
      setFormOpen(false);
      resetForm();
      await refetch();
    } catch {
      setFormError('Unable to create add-on.');
    }
  }

  const columns: DataTableColumn<AddOnRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => <span className="font-medium text-slate-900">{row.name}</span>,
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
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Add-ons"
        actions={
          <Button type="button" onClick={openCreateForm}>
            + New Add-on
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        emptyMessage="No add-ons."
        loading={loading}
        error={error ? 'Unable to load add-ons.' : undefined}
        onRowClick={(row) => openDetail(row.id)}
      />

      <FormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Add add-on"
        onSubmit={handleCreateSubmit}
        submitLabel={creating ? 'Creating…' : 'Add add-on'}
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
          label="Price (₱)"
          name="new-price"
          placeholder="19.99"
          required
          value={price}
          onChange={(event) => setPrice(event.target.value)}
        />
        {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
      </FormDialog>

      {activeId ? (
        <AddOnDetailDrawer
          id={activeId}
          addOns={rows}
          loading={loading}
          error={Boolean(error)}
          refetch={refetch}
          onClose={closeDetail}
          onSaved={() => void refetch()}
        />
      ) : null}
    </div>
  );
}

// There is no standalone `addOn(id)` GraphQL query (only `addOns`, the full
// list — see task-6-brief.md). This drawer receives the already-fetched
// list and `refetch` from `AddOnsPageContent` (the same `useAddOnsQuery`
// backing the table) and finds its row client-side by matching `id` from
// the `detail` search param, the only spec-authorized way to reach a single
// add-on. Reusing the parent's query/refetch (rather than issuing a second
// `useAddOnsQuery` here) avoids a redundant network fetch every time the
// drawer opens.
//
// `loading`/`error` are threaded down from the parent's `useAddOnsQuery`
// too — `addOns` is `[]` while that query is still in flight, so without
// these a cold `?detail=` load (e.g. a legacy `/catalog/add-ons/:id`
// bookmark redirected here) would render "not found" for a moment before
// the data arrives. Matches the loading/error/not-found/content branch
// pattern every other drawer on this branch uses (see `CustomerDetailDrawer`
// in `customers/page.tsx`).
function AddOnDetailDrawer({
  id,
  addOns,
  loading,
  error,
  refetch,
  onClose,
  onSaved,
}: {
  id: string;
  addOns: AddOnDetail[];
  loading: boolean;
  error: boolean;
  refetch: () => Promise<unknown>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const addOn = addOns.find((candidate) => candidate.id === id);

  const title = addOn?.name ?? 'Add-on';

  return (
    <DetailDrawer open onClose={onClose} title={title}>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message="Unable to load add-on." />
      ) : !addOn ? (
        <p className="text-sm text-slate-700">Add-on not found.</p>
      ) : (
        <AddOnEditForm addOn={addOn} refetch={refetch} onSaved={onSaved} />
      )}
    </DetailDrawer>
  );
}

function AddOnEditForm({
  addOn,
  refetch,
  onSaved,
}: {
  addOn: AddOnDetail;
  refetch: () => Promise<unknown>;
  onSaved: () => void;
}) {
  const [updateAddOn, { loading: updating }] = useUpdateAddOnMutation();
  const { success } = useToast();

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
    const priceMinorUnits = parsePriceOrReportError(price, setFormError);
    if (priceMinorUnits === undefined) return;
    try {
      await updateAddOn({
        variables: {
          id: addOn.id,
          input: {
            name,
            description: description.trim() === '' ? null : description,
            active,
            priceMinorUnits,
          },
        },
      });
      await refetch();
      onSaved();
      success('Add-on updated.');
    } catch {
      setFormError('Unable to update add-on.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-slate-900">Add-on details</h3>
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
  );
}
