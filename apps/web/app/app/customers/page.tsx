'use client';

import {
  useCreateCustomerMutation,
  useCreatePropertyMutation,
  useCustomerQuery,
  useCustomersQuery,
  useUpdateCustomerMutation,
  useUpdatePropertyMutation,
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
  useToast,
} from '@clensy/ui';
import type { DataTableColumn } from '@clensy/ui';
import { type FormEvent, Suspense, useEffect, useState } from 'react';
import { useDetailDrawer } from '../../../lib/use-detail-drawer';

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

// Same index-signature note as `CustomerRow` above — `DataTable<T>` requires
// `T extends Record<string, unknown>`.
type PropertyRow = {
  id: string;
  label: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  region: string;
  postalCode: string;
  accessNotes: string | null;
  [key: string]: unknown;
};

type CustomerDetail = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  notes: string | null;
  properties: PropertyRow[];
};

type PropertyFormState = {
  label: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  accessNotes: string;
};

const EMPTY_PROPERTY_FORM: PropertyFormState = {
  label: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  region: '',
  postalCode: '',
  accessNotes: '',
};

// Optional fields (`addressLine2`, `accessNotes`) are cleared to `null`
// rather than sent as an empty string, so the server's partial-update
// merge (spec §4.2) actually clears them instead of retaining stale text.
// Ported verbatim from the pre-migration `customers/[id]/page.tsx` — this is
// a deliberate correctness detail, not incidental formatting.
function toPropertyInput(form: PropertyFormState) {
  return {
    label: form.label,
    addressLine1: form.addressLine1,
    addressLine2: form.addressLine2.trim() === '' ? null : form.addressLine2,
    city: form.city,
    region: form.region,
    postalCode: form.postalCode,
    accessNotes: form.accessNotes.trim() === '' ? null : form.accessNotes,
  };
}

// `useDetailDrawer` reads `useSearchParams()`, which Next.js requires to sit
// under a `<Suspense>` boundary during prerendering (otherwise the whole
// route bails out of static generation with a build-time warning/error).
// The default export supplies that boundary; `CustomersPageContent` holds
// the actual page — list, create dialog, and detail drawer.
export default function CustomersPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <CustomersPageContent />
    </Suspense>
  );
}

function CustomersPageContent() {
  const { data, loading, error, refetch } = useCustomersQuery({ fetchPolicy: 'network-only' });
  const [createCustomer, { loading: creating }] = useCreateCustomerMutation();
  const { activeId, open: openDetail, close: closeDetail } = useDetailDrawer();

  const [formOpen, setFormOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | undefined>(undefined);

  function resetForm() {
    setFullName('');
    setEmail('');
    setPhone('');
    setNotes('');
    setFormError(undefined);
  }

  function openCreateForm() {
    resetForm();
    setFormOpen(true);
  }

  async function handleCreateSubmit() {
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
      setFormOpen(false);
      resetForm();
      await refetch();
    } catch {
      setFormError('Unable to create customer.');
    }
  }

  const columns: DataTableColumn<CustomerRow>[] = [
    {
      key: 'fullName',
      header: 'Name',
      render: (row) => <span className="font-medium text-slate-900">{row.fullName}</span>,
    },
    { key: 'email', header: 'Email' },
    { key: 'phone', header: 'Phone' },
  ];

  const rows: CustomerRow[] = data?.customers ?? [];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Customers"
        actions={
          <Button type="button" onClick={openCreateForm}>
            + New Customer
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        emptyMessage="No customers."
        loading={loading}
        error={error ? 'Unable to load customers.' : undefined}
        onRowClick={(row) => openDetail(row.id)}
      />

      <FormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Add customer"
        onSubmit={handleCreateSubmit}
        submitLabel={creating ? 'Creating…' : 'Add customer'}
        submitting={creating}
      >
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
      </FormDialog>

      {activeId ? (
        <CustomerDetailDrawer id={activeId} onClose={closeDetail} onSaved={() => void refetch()} />
      ) : null}
    </div>
  );
}

function CustomerDetailDrawer({
  id,
  onClose,
  onSaved,
}: {
  id: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data, loading, error, refetch } = useCustomerQuery({
    variables: { id },
    fetchPolicy: 'network-only',
  });

  const title = data?.customer?.fullName ?? 'Customer';

  return (
    <DetailDrawer open onClose={onClose} title={title}>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message="Unable to load customer." />
      ) : !data?.customer ? (
        <p className="text-sm text-slate-700">Customer not found.</p>
      ) : (
        <div className="flex flex-col gap-8">
          <CustomerEditForm customer={data.customer} refetch={refetch} onSaved={onSaved} />
          <CustomerProperties
            customerId={data.customer.id}
            properties={data.customer.properties}
            refetch={refetch}
          />
        </div>
      )}
    </DetailDrawer>
  );
}

function CustomerEditForm({
  customer,
  refetch,
  onSaved,
}: {
  customer: CustomerDetail;
  refetch: () => Promise<unknown>;
  onSaved: () => void;
}) {
  const [updateCustomer, { loading: updating }] = useUpdateCustomerMutation();
  const { success } = useToast();

  const [fullName, setFullName] = useState(customer.fullName);
  const [email, setEmail] = useState(customer.email);
  const [phone, setPhone] = useState(customer.phone);
  const [notes, setNotes] = useState(customer.notes ?? '');
  const [formError, setFormError] = useState<string | undefined>(undefined);

  useEffect(() => {
    setFullName(customer.fullName);
    setEmail(customer.email);
    setPhone(customer.phone);
    setNotes(customer.notes ?? '');
  }, [customer.fullName, customer.email, customer.phone, customer.notes]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    try {
      await updateCustomer({
        variables: {
          id: customer.id,
          input: {
            fullName,
            email,
            phone,
            notes: notes.trim() === '' ? null : notes,
          },
        },
      });
      await refetch();
      onSaved();
      success('Customer updated.');
    } catch {
      setFormError('Unable to update customer.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormField
        label="Full name"
        name="fullName"
        required
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
      />
      <FormField
        label="Email"
        name="email"
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <FormField
        label="Phone"
        name="phone"
        required
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
      />
      <FormField label="Notes" name="notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
      {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
      <Button type="submit" disabled={updating}>
        {updating ? 'Saving…' : 'Save customer'}
      </Button>
    </form>
  );
}

// Ported from the pre-migration `customers/[id]/page.tsx`'s "Properties",
// "Add property", and "Edit property" sections — ~verbatim logic, laid out
// as always-visible inline sections stacked inside the drawer (rather than
// as a nested `FormDialog`/`Modal`) for a specific reason: `Modal` and
// `DetailDrawer` both close on Escape via a shared `useDialogBehavior` hook
// that attaches its own `document`-level `keydown` listener whenever `open`
// is `true`, with no awareness of other open dialogs. Nesting a second
// `Modal`-based dialog inside this already-open `DetailDrawer` would mean an
// Escape press meant to dismiss only the inner property form also fires the
// drawer's own listener in the same event dispatch, closing the customer
// drawer (and navigating the URL away via `useDetailDrawer`'s `close()`) at
// the same time — a real, easy-to-trigger bug, not a hypothetical one. Two
// inline sections avoid it entirely: there is exactly one dialog open
// (the drawer itself) at any time.
function CustomerProperties({
  customerId,
  properties,
  refetch,
}: {
  customerId: string;
  properties: PropertyRow[];
  refetch: () => Promise<unknown>;
}) {
  const [createProperty, { loading: creatingProperty }] = useCreatePropertyMutation();
  const [updateProperty, { loading: updatingProperty }] = useUpdatePropertyMutation();
  const { success } = useToast();

  // --- Add property form ---
  const [newProperty, setNewProperty] = useState<PropertyFormState>(EMPTY_PROPERTY_FORM);
  const [addPropertyError, setAddPropertyError] = useState<string | undefined>(undefined);

  async function handleAddPropertySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAddPropertyError(undefined);
    try {
      await createProperty({
        variables: {
          customerId,
          input: toPropertyInput(newProperty),
        },
      });
      setNewProperty(EMPTY_PROPERTY_FORM);
      await refetch();
      success('Property added.');
    } catch {
      setAddPropertyError('Unable to create property.');
    }
  }

  // --- Edit property (per-row) form ---
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [editProperty, setEditProperty] = useState<PropertyFormState>(EMPTY_PROPERTY_FORM);
  const [editPropertyError, setEditPropertyError] = useState<string | undefined>(undefined);

  function startEditingProperty(row: PropertyRow) {
    setEditingPropertyId(row.id);
    setEditProperty({
      label: row.label,
      addressLine1: row.addressLine1,
      addressLine2: row.addressLine2 ?? '',
      city: row.city,
      region: row.region,
      postalCode: row.postalCode,
      accessNotes: row.accessNotes ?? '',
    });
    setEditPropertyError(undefined);
  }

  function cancelEditingProperty() {
    setEditingPropertyId(null);
    setEditProperty(EMPTY_PROPERTY_FORM);
    setEditPropertyError(undefined);
  }

  async function handleEditPropertySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingPropertyId) return;
    setEditPropertyError(undefined);
    try {
      await updateProperty({
        variables: {
          id: editingPropertyId,
          input: toPropertyInput(editProperty),
        },
      });
      setEditingPropertyId(null);
      setEditProperty(EMPTY_PROPERTY_FORM);
      await refetch();
      success('Property updated.');
    } catch {
      setEditPropertyError('Unable to update property.');
    }
  }

  const propertyColumns: DataTableColumn<PropertyRow>[] = [
    { key: 'label', header: 'Label' },
    {
      key: 'address',
      header: 'Address',
      render: (row) => (row.addressLine2 ? `${row.addressLine1}, ${row.addressLine2}` : row.addressLine1),
    },
    { key: 'city', header: 'City' },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Button variant="secondary" onClick={() => startEditingProperty(row)}>
          Edit
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Properties</h3>
        <DataTable
          columns={propertyColumns}
          rows={properties}
          rowKey={(row) => row.id}
          emptyMessage="No properties."
        />
      </div>

      {editingPropertyId ? (
        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Edit property</h3>
          <form onSubmit={handleEditPropertySubmit} className="flex flex-col gap-4">
            <FormField
              label="Label"
              name="edit-label"
              required
              value={editProperty.label}
              onChange={(event) => setEditProperty((prev) => ({ ...prev, label: event.target.value }))}
            />
            <FormField
              label="Address line 1"
              name="edit-addressLine1"
              required
              value={editProperty.addressLine1}
              onChange={(event) => setEditProperty((prev) => ({ ...prev, addressLine1: event.target.value }))}
            />
            <FormField
              label="Address line 2"
              name="edit-addressLine2"
              value={editProperty.addressLine2}
              onChange={(event) => setEditProperty((prev) => ({ ...prev, addressLine2: event.target.value }))}
            />
            <FormField
              label="City"
              name="edit-city"
              required
              value={editProperty.city}
              onChange={(event) => setEditProperty((prev) => ({ ...prev, city: event.target.value }))}
            />
            <FormField
              label="Region"
              name="edit-region"
              required
              value={editProperty.region}
              onChange={(event) => setEditProperty((prev) => ({ ...prev, region: event.target.value }))}
            />
            <FormField
              label="Postal code"
              name="edit-postalCode"
              required
              value={editProperty.postalCode}
              onChange={(event) => setEditProperty((prev) => ({ ...prev, postalCode: event.target.value }))}
            />
            <FormField
              label="Access notes"
              name="edit-accessNotes"
              value={editProperty.accessNotes}
              onChange={(event) => setEditProperty((prev) => ({ ...prev, accessNotes: event.target.value }))}
            />
            {editPropertyError ? <p className="text-sm text-red-600">{editPropertyError}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" disabled={updatingProperty}>
                {updatingProperty ? 'Saving…' : 'Save property'}
              </Button>
              <Button type="button" variant="secondary" onClick={cancelEditingProperty}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-200 p-4">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Add property</h3>
        <form onSubmit={handleAddPropertySubmit} className="flex flex-col gap-4">
          <FormField
            label="Label"
            name="new-label"
            required
            value={newProperty.label}
            onChange={(event) => setNewProperty((prev) => ({ ...prev, label: event.target.value }))}
          />
          <FormField
            label="Address line 1"
            name="new-addressLine1"
            required
            value={newProperty.addressLine1}
            onChange={(event) => setNewProperty((prev) => ({ ...prev, addressLine1: event.target.value }))}
          />
          <FormField
            label="Address line 2"
            name="new-addressLine2"
            value={newProperty.addressLine2}
            onChange={(event) => setNewProperty((prev) => ({ ...prev, addressLine2: event.target.value }))}
          />
          <FormField
            label="City"
            name="new-city"
            required
            value={newProperty.city}
            onChange={(event) => setNewProperty((prev) => ({ ...prev, city: event.target.value }))}
          />
          <FormField
            label="Region"
            name="new-region"
            required
            value={newProperty.region}
            onChange={(event) => setNewProperty((prev) => ({ ...prev, region: event.target.value }))}
          />
          <FormField
            label="Postal code"
            name="new-postalCode"
            required
            value={newProperty.postalCode}
            onChange={(event) => setNewProperty((prev) => ({ ...prev, postalCode: event.target.value }))}
          />
          <FormField
            label="Access notes"
            name="new-accessNotes"
            value={newProperty.accessNotes}
            onChange={(event) => setNewProperty((prev) => ({ ...prev, accessNotes: event.target.value }))}
          />
          {addPropertyError ? <p className="text-sm text-red-600">{addPropertyError}</p> : null}
          <Button type="submit" disabled={creatingProperty}>
            {creatingProperty ? 'Creating…' : 'Add property'}
          </Button>
        </form>
      </div>
    </div>
  );
}
