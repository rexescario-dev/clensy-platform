'use client';

import {
  useCreatePropertyMutation,
  useCustomerQuery,
  useUpdateCustomerMutation,
  useUpdatePropertyMutation,
} from '@clensy/client';
import { Button, DataTable, FormField } from '@clensy/ui';
import type { DataTableColumn } from '@clensy/ui';
import { useParams } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

// `DataTable<T>` (packages/ui) constrains `T extends Record<string, unknown>`
// — the index signature below satisfies that constraint while keeping the
// named fields concretely typed.
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

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data, loading, error, refetch } = useCustomerQuery({
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
        <p className="text-sm text-red-600">Unable to load customer.</p>
      </main>
    );
  }

  if (!data?.customer) {
    return (
      <main className="p-6">
        <p className="text-sm text-slate-700">Customer not found.</p>
      </main>
    );
  }

  return <CustomerDetail id={id} customer={data.customer} refetch={refetch} />;
}

function CustomerDetail({
  id,
  customer,
  refetch,
}: {
  id: string;
  customer: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    notes: string | null;
    properties: PropertyRow[];
  };
  refetch: () => Promise<unknown>;
}) {
  const [updateCustomer, { loading: updatingCustomer }] = useUpdateCustomerMutation();
  const [createProperty, { loading: creatingProperty }] = useCreatePropertyMutation();
  const [updateProperty, { loading: updatingProperty }] = useUpdatePropertyMutation();

  // --- Customer edit form ---
  const [fullName, setFullName] = useState(customer.fullName);
  const [email, setEmail] = useState(customer.email);
  const [phone, setPhone] = useState(customer.phone);
  const [notes, setNotes] = useState(customer.notes ?? '');
  const [customerFormError, setCustomerFormError] = useState<string | undefined>(undefined);

  useEffect(() => {
    setFullName(customer.fullName);
    setEmail(customer.email);
    setPhone(customer.phone);
    setNotes(customer.notes ?? '');
  }, [customer.fullName, customer.email, customer.phone, customer.notes]);

  async function handleCustomerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCustomerFormError(undefined);
    try {
      await updateCustomer({
        variables: {
          id,
          input: {
            fullName,
            email,
            phone,
            notes: notes.trim() === '' ? null : notes,
          },
        },
      });
      await refetch();
    } catch {
      setCustomerFormError('Unable to update customer.');
    }
  }

  // --- Add property form ---
  const [newProperty, setNewProperty] = useState<PropertyFormState>(EMPTY_PROPERTY_FORM);
  const [addPropertyError, setAddPropertyError] = useState<string | undefined>(undefined);

  async function handleAddPropertySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAddPropertyError(undefined);
    try {
      await createProperty({
        variables: {
          customerId: id,
          input: toPropertyInput(newProperty),
        },
      });
      setNewProperty(EMPTY_PROPERTY_FORM);
      await refetch();
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
    <main className="flex flex-col gap-8 p-6">
      <h1 className="text-lg font-semibold text-slate-900">{customer.fullName}</h1>

      <section className="max-w-sm rounded-lg border border-slate-200 p-4">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Customer details</h2>
        <form onSubmit={handleCustomerSubmit} className="flex flex-col gap-4">
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
          {customerFormError ? <p className="text-sm text-red-600">{customerFormError}</p> : null}
          <Button type="submit" disabled={updatingCustomer}>
            {updatingCustomer ? 'Saving…' : 'Save customer'}
          </Button>
        </form>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Properties</h2>
        <DataTable
          columns={propertyColumns}
          rows={customer.properties}
          rowKey={(row) => row.id}
          emptyMessage="No properties."
        />
      </section>

      {editingPropertyId ? (
        <section className="max-w-sm rounded-lg border border-slate-200 p-4">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Edit property</h2>
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
        </section>
      ) : null}

      <section className="max-w-sm rounded-lg border border-slate-200 p-4">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Add property</h2>
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
      </section>
    </main>
  );
}
