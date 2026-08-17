'use client';

import {
  useCreateCustomerMutation,
  useCustomerQuery,
  useCustomersQuery,
  useUpdateCustomerMutation,
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
        <CustomerEditForm customer={data.customer} refetch={refetch} onSaved={onSaved} />
      )}
    </DetailDrawer>
  );
}

function CustomerEditForm({
  customer,
  refetch,
  onSaved,
}: {
  customer: { id: string; fullName: string; email: string; phone: string; notes: string | null };
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
