'use client';

import {
  useAssignTeamToJobMutation,
  useBookingsQuery,
  useCompleteChecklistItemMutation,
  useCompleteJobMutation,
  useCreateJobFromBookingMutation,
  useJobQuery,
  useJobsQuery,
  useTeamsQuery,
} from '@clensy/client';
import type { JobStatus } from '@clensy/client';
import {
  Button,
  DataTable,
  DetailDrawer,
  ErrorState,
  FormDialog,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '@clensy/ui';
import type { DataTableColumn, StatusTone } from '@clensy/ui';
import { Suspense, useState } from 'react';
import { useDetailDrawer } from '../../../lib/use-detail-drawer';

type ChecklistItemRow = {
  id: string;
  label: string;
  position: number;
  completed: boolean;
  completedAt: unknown;
};

type JobRow = {
  id: string;
  scheduledAt: unknown;
  status: JobStatus;
  booking: {
    id: string;
    scheduledAt: unknown;
    status: string;
    customer: { id: string; fullName: string };
    property: { id: string; addressLine1: string };
    service: { id: string; name: string };
  };
  team: { id: string; name: string } | null;
  checklist: { id: string; items: ChecklistItemRow[] };
  [key: string]: unknown;
};

function formatScheduledAt(value: unknown): string {
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function checklistProgress(items: ChecklistItemRow[]): string {
  return `${items.filter((item) => item.completed).length} / ${items.length}`;
}

function jobStatusTone(status: JobStatus): StatusTone {
  if (status === 'COMPLETED') return 'success';
  if (status === 'IN_PROGRESS') return 'warning';
  return 'neutral';
}

export default function JobsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <JobsPageContent />
    </Suspense>
  );
}

function JobsPageContent() {
  const jobsQuery = useJobsQuery({ fetchPolicy: 'network-only' });
  const { data: bookingsData } = useBookingsQuery({ fetchPolicy: 'network-only' });
  const [createJob, { loading: creating }] = useCreateJobFromBookingMutation();
  const { activeId, open: openDetail, close: closeDetail } = useDetailDrawer();

  const [formOpen, setFormOpen] = useState(false);
  const [bookingId, setBookingId] = useState('');
  const [formError, setFormError] = useState<string | undefined>(undefined);

  function resetForm() {
    setBookingId('');
    setFormError(undefined);
  }

  function openCreateForm() {
    resetForm();
    setFormOpen(true);
  }

  async function handleCreateSubmit() {
    setFormError(undefined);
    try {
      const result = await createJob({
        variables: { input: { bookingId } },
      });
      const newId = result.data?.createJobFromBooking.id;
      setFormOpen(false);
      resetForm();
      await jobsQuery.refetch();
      if (newId) {
        openDetail(newId);
      }
    } catch {
      setFormError('Unable to create job.');
    }
  }

  const columns: DataTableColumn<JobRow>[] = [
    {
      key: 'customer',
      header: 'Customer',
      render: (row) => row.booking.customer.fullName,
    },
    {
      key: 'property',
      header: 'Property',
      render: (row) => row.booking.property.addressLine1,
    },
    {
      key: 'service',
      header: 'Service',
      render: (row) => row.booking.service.name,
    },
    {
      key: 'scheduledAt',
      header: 'Scheduled',
      render: (row) => formatScheduledAt(row.scheduledAt),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge label={row.status} tone={jobStatusTone(row.status)} />
      ),
    },
    {
      key: 'team',
      header: 'Team',
      render: (row) => row.team?.name ?? 'Unassigned',
    },
    {
      key: 'progress',
      header: 'Checklist',
      render: (row) => checklistProgress(row.checklist.items),
    },
  ];

  const rows: JobRow[] = (jobsQuery.data?.jobs ?? []) as JobRow[];
  const bookingIdsWithJobs = new Set(rows.map((row) => row.booking.id));
  const availableBookings = (bookingsData?.bookings.nodes ?? []).filter(
    (booking) => !bookingIdsWithJobs.has(booking.id),
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Jobs"
        actions={
          <Button type="button" onClick={openCreateForm}>
            + New Job
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        emptyMessage="No jobs."
        loading={jobsQuery.loading}
        error={jobsQuery.error ? 'Unable to load jobs.' : undefined}
        onRowClick={(row) => openDetail(row.id)}
      />

      <FormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="New job"
        onSubmit={handleCreateSubmit}
        submitLabel={creating ? 'Creating…' : 'Create job'}
        submitting={creating}
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="job-booking" className="text-sm font-medium text-slate-700">
            Booking
          </label>
          <select
            id="job-booking"
            name="job-booking"
            required
            value={bookingId}
            onChange={(event) => setBookingId(event.currentTarget.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <option value="">Select a booking</option>
            {availableBookings.map((booking) => (
              <option key={booking.id} value={booking.id}>
                {booking.customer.fullName} — {booking.service.name} (
                {formatScheduledAt(booking.scheduledAt)})
              </option>
            ))}
          </select>
        </div>
        {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
      </FormDialog>

      {activeId ? (
        <JobDetailDrawer
          id={activeId}
          onClose={closeDetail}
          onChanged={() => void jobsQuery.refetch()}
        />
      ) : null}
    </div>
  );
}

function JobDetailDrawer({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data, loading, error, refetch } = useJobQuery({
    variables: { id },
    fetchPolicy: 'network-only',
  });
  const { data: teamsData } = useTeamsQuery({
    fetchPolicy: 'network-only',
    variables: { paging: { limit: 100 } },
  });
  const [assignTeam, { loading: assigning }] = useAssignTeamToJobMutation();
  const [completeItem] = useCompleteChecklistItemMutation();
  const [completeJob, { loading: completing }] = useCompleteJobMutation();

  const [teamId, setTeamId] = useState<string | undefined>(undefined);
  const [actionError, setActionError] = useState<string | undefined>(undefined);

  const job = data?.job;
  const teams = teamsData?.teams.nodes ?? [];
  const teamIdValue = teamId ?? job?.team?.id ?? '';
  const items = job?.checklist.items ?? [];
  const allItemsComplete = items.length > 0 && items.every((item) => item.completed);
  const isCompleted = job?.status === 'COMPLETED';
  const canCompleteJob = allItemsComplete && !isCompleted;

  async function handleAssignTeam() {
    if (!job || teamIdValue === '') return;
    setActionError(undefined);
    try {
      await assignTeam({
        variables: { input: { jobId: job.id, teamId: teamIdValue } },
      });
      await refetch();
      onChanged();
    } catch {
      setActionError('Unable to assign team.');
    }
  }

  async function handleCompleteItem(itemId: string) {
    if (!job) return;
    setActionError(undefined);
    try {
      await completeItem({
        variables: { input: { jobId: job.id, itemId } },
      });
      await refetch();
      onChanged();
    } catch {
      setActionError('Unable to complete checklist item.');
    }
  }

  async function handleCompleteJob() {
    if (!job) return;
    setActionError(undefined);
    try {
      await completeJob({ variables: { input: { id: job.id } } });
      await refetch();
      onChanged();
    } catch {
      setActionError('Unable to complete job.');
    }
  }

  const title = job
    ? `${job.booking.customer.fullName} — ${job.booking.service.name}`
    : 'Job';

  return (
    <DetailDrawer open onClose={onClose} title={title}>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message="Unable to load job." />
      ) : !job ? (
        <p className="text-sm text-slate-700">Job not found.</p>
      ) : (
        <div className="flex flex-col gap-6">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500">Customer</dt>
            <dd className="text-slate-900">{job.booking.customer.fullName}</dd>
            <dt className="text-slate-500">Property</dt>
            <dd className="text-slate-900">{job.booking.property.addressLine1}</dd>
            <dt className="text-slate-500">Service</dt>
            <dd className="text-slate-900">{job.booking.service.name}</dd>
            <dt className="text-slate-500">Booking status</dt>
            <dd className="text-slate-900">{job.booking.status}</dd>
            <dt className="text-slate-500">Booking scheduled</dt>
            <dd className="text-slate-900">{formatScheduledAt(job.booking.scheduledAt)}</dd>
            <dt className="text-slate-500">Job scheduled</dt>
            <dd className="text-slate-900">{formatScheduledAt(job.scheduledAt)}</dd>
            <dt className="text-slate-500">Job status</dt>
            <dd>
              <StatusBadge label={job.status} tone={jobStatusTone(job.status)} />
            </dd>
          </dl>

          {isCompleted ? null : (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="job-team" className="text-sm font-medium text-slate-700">
                  Team
                </label>
                <select
                  id="job-team"
                  name="job-team"
                  value={teamIdValue}
                  onChange={(event) => setTeamId(event.currentTarget.value)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <option value="">Select a team</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={assigning || teamIdValue === ''}
                onClick={() => void handleAssignTeam()}
              >
                {assigning ? 'Assigning…' : 'Assign team'}
              </Button>
            </div>
          )}

          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Checklist</h3>
            <ul className="flex flex-col gap-2">
              {items.map((item) => {
                const disabled = item.completed || isCompleted;
                return (
                  <li key={item.id} className="flex items-center gap-2 text-sm">
                    <input
                      id={`checklist-item-${item.id}`}
                      type="checkbox"
                      checked={item.completed}
                      disabled={disabled}
                      onChange={() => {
                        if (!disabled) {
                          void handleCompleteItem(item.id);
                        }
                      }}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <label
                      htmlFor={`checklist-item-${item.id}`}
                      className={item.completed ? 'text-slate-500 line-through' : 'text-slate-900'}
                    >
                      {item.label}
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-slate-500">
              {checklistProgress(items)} complete
            </p>
          </div>

          {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}

          <Button
            type="button"
            disabled={!canCompleteJob || completing}
            onClick={() => void handleCompleteJob()}
          >
            {completing ? 'Completing…' : 'Complete job'}
          </Button>
        </div>
      )}
    </DetailDrawer>
  );
}
