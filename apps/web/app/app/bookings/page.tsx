'use client';

import {
  useBookingQuery,
  useBookingsQuery,
  useCreateBookingMutation,
  useCreateJobFromBookingMutation,
  useCustomerPropertiesQuery,
  useCustomersQuery,
  useJobsQuery,
  useRemoveBookingMutation,
  useServicesQuery,
  useTeamsQuery,
  useUpdateBookingMutation,
} from '@clensy/client';
import type { BookingStatus } from '@clensy/client';
import { useRouter } from 'next/navigation';
import {
  Button,
  ConfirmDialog,
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
import { type ChangeEvent, type FormEvent, Suspense, useState } from 'react';
import { formatMinorUnits } from '../../../lib/format-price';
import { useDetailDrawer } from '../../../lib/use-detail-drawer';

// `DataTable<T>` (packages/ui) constrains `T extends Record<string, unknown>`.
type BookingRow = {
  id: string;
  scheduledAt: unknown;
  status: BookingStatus;
  pricingSnapshot: { priceMinorUnits: number };
  customer: { id: string; fullName: string };
  property: { id: string; addressLine1: string };
  service: { id: string; name: string };
  team: { id: string; name: string } | null;
  [key: string]: unknown;
};

const BOOKING_STATUSES: BookingStatus[] = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'];

function formatScheduledAt(value: unknown): string {
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

// `<input type="datetime-local">` both reads and writes its `value` as a
// wall-clock string in the *browser's local* timezone — not UTC. Building
// it from `Date`'s local getters (not `.toISOString()`, which is UTC) is
// required, not a style choice: pre-filling the edit form with the UTC
// string here silently shifted every re-saved `scheduledAt` by the
// browser's UTC offset (verified directly by testing the edit flow, not
// merely assumed correct).
function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// `useDetailDrawer` reads `useSearchParams()`, which Next.js requires to sit
// under a `<Suspense>` boundary during prerendering — same shell shape as
// `customers/page.tsx`/`cleaners/page.tsx`.
export default function BookingsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <BookingsPageContent />
    </Suspense>
  );
}

function BookingsPageContent() {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const { data, loading, error, refetch } = useBookingsQuery({
    fetchPolicy: 'network-only',
    variables: { paging: { limit: pageSize, offset: (page - 1) * pageSize } },
  });
  const [createBooking, { loading: creating }] = useCreateBookingMutation();
  const { activeId, open: openDetail, close: closeDetail } = useDetailDrawer();

  const { data: customersData } = useCustomersQuery({
    fetchPolicy: 'network-only',
    variables: { paging: { limit: 100 } },
  });
  const { data: servicesData } = useServicesQuery({
    fetchPolicy: 'network-only',
    variables: { paging: { limit: 100 } },
  });
  const { data: teamsData } = useTeamsQuery({
    fetchPolicy: 'network-only',
    variables: { paging: { limit: 100 } },
  });

  const [formOpen, setFormOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [formError, setFormError] = useState<string | undefined>(undefined);

  const { data: propertiesData } = useCustomerPropertiesQuery({
    variables: { customerId, paging: { limit: 100 } },
    skip: customerId === '',
    fetchPolicy: 'network-only',
  });

  function resetForm() {
    setCustomerId('');
    setPropertyId('');
    setServiceId('');
    setTeamId('');
    setScheduledAt('');
    setFormError(undefined);
  }

  function openCreateForm() {
    resetForm();
    setFormOpen(true);
  }

  function handleCustomerChange(event: ChangeEvent<HTMLSelectElement>) {
    setCustomerId(event.currentTarget.value);
    setPropertyId('');
  }

  async function handleCreateSubmit() {
    setFormError(undefined);
    try {
      await createBooking({
        variables: {
          createBookingInput: {
            customerId,
            propertyId,
            serviceId,
            teamId: teamId === '' ? undefined : teamId,
            scheduledAt: new Date(scheduledAt),
          },
        },
      });
      setFormOpen(false);
      resetForm();
      await refetch();
    } catch {
      setFormError('Unable to create booking.');
    }
  }

  const columns: DataTableColumn<BookingRow>[] = [
    { key: 'customer', header: 'Customer', render: (row) => row.customer.fullName },
    { key: 'property', header: 'Property', render: (row) => row.property.addressLine1 },
    { key: 'service', header: 'Service', render: (row) => row.service.name },
    { key: 'scheduledAt', header: 'Scheduled', render: (row) => formatScheduledAt(row.scheduledAt) },
    { key: 'status', header: 'Status', render: (row) => row.status },
    { key: 'team', header: 'Team', render: (row) => row.team?.name ?? 'Unassigned' },
    {
      key: 'price',
      header: 'Price',
      render: (row) => formatMinorUnits(row.pricingSnapshot.priceMinorUnits),
    },
  ];

  const rows: BookingRow[] = (data?.bookings.nodes ?? []) as BookingRow[];
  const customers = customersData?.customers.nodes ?? [];
  const properties = propertiesData?.customerProperties.nodes ?? [];
  const activeServices = (servicesData?.services.nodes ?? []).filter(
    (service) => service.active,
  );
  const teams = teamsData?.teams.nodes ?? [];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Bookings"
        actions={
          <Button type="button" onClick={openCreateForm}>
            + New Booking
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        emptyMessage="No bookings."
        loading={loading}
        error={error ? 'Unable to load bookings.' : undefined}
        onRowClick={(row) => openDetail(row.id)}
        pagination={{
          page,
          pageSize,
          totalCount: data?.bookings.totalCount ?? 0,
          onPageChange: setPage,
        }}
      />

      <FormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="New booking"
        onSubmit={handleCreateSubmit}
        submitLabel={creating ? 'Creating…' : 'Create booking'}
        submitting={creating}
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="booking-customer" className="text-sm font-medium text-slate-700">
            Customer
          </label>
          <select
            id="booking-customer"
            name="booking-customer"
            required
            value={customerId}
            onChange={handleCustomerChange}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <option value="">Select a customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.fullName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="booking-property" className="text-sm font-medium text-slate-700">
            Property
          </label>
          <select
            id="booking-property"
            name="booking-property"
            required
            disabled={customerId === ''}
            value={propertyId}
            onChange={(event) => setPropertyId(event.currentTarget.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:bg-slate-100"
          >
            <option value="">
              {customerId === '' ? 'Select a customer first' : 'Select a property'}
            </option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.addressLine1}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="booking-service" className="text-sm font-medium text-slate-700">
            Service
          </label>
          <select
            id="booking-service"
            name="booking-service"
            required
            value={serviceId}
            onChange={(event) => setServiceId(event.currentTarget.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <option value="">Select a service</option>
            {activeServices.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="booking-team" className="text-sm font-medium text-slate-700">
            Team (optional)
          </label>
          <select
            id="booking-team"
            name="booking-team"
            value={teamId}
            onChange={(event) => setTeamId(event.currentTarget.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <option value="">Unassigned</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>

        <FormField
          label="Scheduled at"
          name="booking-scheduledAt"
          type="datetime-local"
          required
          value={scheduledAt}
          onChange={(event) => setScheduledAt(event.target.value)}
        />

        {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
      </FormDialog>

      {activeId ? (
        <BookingDetailDrawer id={activeId} onClose={closeDetail} onSaved={() => void refetch()} />
      ) : null}
    </div>
  );
}

function BookingDetailDrawer({
  id,
  onClose,
  onSaved,
}: {
  id: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const { data, loading, error, refetch } = useBookingQuery({
    variables: { id },
    fetchPolicy: 'network-only',
  });
  const { data: teamsData } = useTeamsQuery({
    fetchPolicy: 'network-only',
    variables: { paging: { limit: 100 } },
  });
  const { data: jobsData, refetch: refetchJobs } = useJobsQuery({
    fetchPolicy: 'network-only',
    skip: !id,
    variables: {
      filter: { booking: { id: { eq: id } } },
      paging: { limit: 1 },
    },
  });
  const [updateBooking, { loading: updating }] = useUpdateBookingMutation();
  const [removeBooking, { loading: removing }] = useRemoveBookingMutation();
  const [createJob, { loading: creatingJob }] = useCreateJobFromBookingMutation();
  const { success } = useToast();

  const [editScheduledAt, setEditScheduledAt] = useState<string | undefined>(undefined);
  const [editStatus, setEditStatus] = useState<BookingStatus | undefined>(undefined);
  const [editTeamId, setEditTeamId] = useState<string | undefined>(undefined);
  const [editError, setEditError] = useState<string | undefined>(undefined);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>(undefined);
  const [jobError, setJobError] = useState<string | undefined>(undefined);

  const booking = data?.booking;
  const teams = teamsData?.teams.nodes ?? [];
  const existingJob = jobsData?.jobs.nodes[0];

  // Local edit state initializes from the loaded booking on first render
  // of each field, then tracks the user's own edits from there.
  const scheduledAtValue =
    editScheduledAt ??
    (booking ? toDatetimeLocalValue(new Date(booking.scheduledAt as string)) : '');
  const statusValue = editStatus ?? booking?.status;
  const teamIdValue = editTeamId ?? booking?.team?.id ?? '';

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!booking) return;
    setEditError(undefined);
    try {
      await updateBooking({
        variables: {
          updateBookingInput: {
            id: booking.id,
            scheduledAt: new Date(scheduledAtValue),
            status: statusValue,
            teamId: teamIdValue === '' ? null : teamIdValue,
          },
        },
      });
      await refetch();
      onSaved();
      success('Booking updated.');
    } catch {
      setEditError('Unable to update booking.');
    }
  }

  async function handleConfirmDelete() {
    if (!booking) return;
    setDeleteError(undefined);
    try {
      await removeBooking({ variables: { id: booking.id } });
      onSaved();
      onClose();
    } catch {
      // ConfirmDialog has no error-display slot; the dialog still closes
      // here (matching admin/page.tsx's precedent), failure surfaces below.
      setDeleteError('Unable to delete booking.');
    } finally {
      setConfirmDeleteOpen(false);
    }
  }

  async function handleCreateJob() {
    if (!booking) return;
    setJobError(undefined);
    try {
      const result = await createJob({
        variables: { input: { bookingId: booking.id } },
      });
      const newId = result.data?.createJobFromBooking.id;
      await refetchJobs();
      if (newId) {
        router.push(`/app/jobs?detail=${newId}`);
      }
    } catch {
      setJobError('Unable to create job.');
    }
  }

  const title = booking ? `${booking.customer.fullName} — ${booking.service.name}` : 'Booking';

  return (
    <DetailDrawer open onClose={onClose} title={title}>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message="Unable to load booking." />
      ) : !booking ? (
        <p className="text-sm text-slate-700">Booking not found.</p>
      ) : (
        <div className="flex flex-col gap-6">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500">Customer</dt>
            <dd className="text-slate-900">{booking.customer.fullName}</dd>
            <dt className="text-slate-500">Property</dt>
            <dd className="text-slate-900">{booking.property.addressLine1}</dd>
            <dt className="text-slate-500">Service</dt>
            <dd className="text-slate-900">{booking.service.name}</dd>
            <dt className="text-slate-500">Price</dt>
            <dd className="text-slate-900">
              {formatMinorUnits(booking.pricingSnapshot.priceMinorUnits)}
            </dd>
          </dl>

          <div>
            {existingJob ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push(`/app/jobs?detail=${existingJob.id}`)}
              >
                View job
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                disabled={creatingJob}
                onClick={() => void handleCreateJob()}
              >
                {creatingJob ? 'Creating…' : 'Create job'}
              </Button>
            )}
            {jobError ? <p className="mt-2 text-sm text-red-600">{jobError}</p> : null}
          </div>

          <form onSubmit={(event) => void handleEditSubmit(event)} className="flex flex-col gap-4">
            <FormField
              label="Scheduled at"
              name="edit-scheduledAt"
              type="datetime-local"
              required
              value={scheduledAtValue}
              onChange={(event) => setEditScheduledAt(event.target.value)}
            />

            <div className="flex flex-col gap-1">
              <label htmlFor="edit-status" className="text-sm font-medium text-slate-700">
                Status
              </label>
              <select
                id="edit-status"
                name="edit-status"
                value={statusValue}
                onChange={(event) => setEditStatus(event.currentTarget.value as BookingStatus)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                {BOOKING_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="edit-team" className="text-sm font-medium text-slate-700">
                Team
              </label>
              <select
                id="edit-team"
                name="edit-team"
                value={teamIdValue}
                onChange={(event) => setEditTeamId(event.currentTarget.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <option value="">Unassigned</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>

            {editError ? <p className="text-sm text-red-600">{editError}</p> : null}
            <Button type="submit" disabled={updating}>
              {updating ? 'Saving…' : 'Save changes'}
            </Button>
          </form>

          <div className="border-t border-slate-200 pt-4">
            <Button
              type="button"
              variant="danger"
              onClick={() => setConfirmDeleteOpen(true)}
            >
              Delete booking
            </Button>
            {deleteError ? <p className="mt-2 text-sm text-red-600">{deleteError}</p> : null}
          </div>

          <ConfirmDialog
            open={confirmDeleteOpen}
            onClose={() => setConfirmDeleteOpen(false)}
            onConfirm={handleConfirmDelete}
            title="Delete this booking?"
            description={`This will permanently delete the booking for ${booking.customer.fullName} (${booking.service.name}). This cannot be undone.`}
            confirmLabel="Delete"
            confirming={removing}
          />
        </div>
      )}
    </DetailDrawer>
  );
}
