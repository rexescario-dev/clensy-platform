'use client';

import {
  useAssignCleanerToTeamMutation,
  useCleanerQuery,
  useCleanersQuery,
  useCreateCleanerMutation,
  useTeamsQuery,
  useUpdateCleanerMutation,
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
import { type ChangeEvent, type FormEvent, Suspense, useEffect, useState } from 'react';
import { useDetailDrawer } from '../../../lib/use-detail-drawer';

// `DataTable<T>` (packages/ui) constrains `T extends Record<string, unknown>`
// — the index signature below satisfies that constraint while keeping the
// named fields concretely typed.
type CleanerRow = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  team: { id: string; name: string } | null;
  [key: string]: unknown;
};

type CleanerDetail = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  notes: string | null;
  team: { id: string; name: string } | null;
};

// `useDetailDrawer` reads `useSearchParams()`, which Next.js requires to sit
// under a `<Suspense>` boundary during prerendering (otherwise the whole
// route bails out of static generation with a build-time warning/error).
// The default export supplies that boundary; `CleanersPageContent` holds
// the actual page — list, create dialog, and detail drawer.
export default function CleanersPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <CleanersPageContent />
    </Suspense>
  );
}

function CleanersPageContent() {
  const { data, loading, error, refetch } = useCleanersQuery({ fetchPolicy: 'network-only' });
  const [createCleaner, { loading: creating }] = useCreateCleanerMutation();
  const { activeId, open: openDetail, close: closeDetail } = useDetailDrawer();

  const [formOpen, setFormOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | undefined>(undefined);

  function resetForm() {
    setFullName('');
    setPhone('');
    setEmail('');
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
      await createCleaner({
        variables: {
          input: {
            fullName,
            phone,
            email,
            notes: notes.trim() === '' ? undefined : notes,
          },
        },
      });
      setFormOpen(false);
      resetForm();
      await refetch();
    } catch {
      setFormError('Unable to create cleaner.');
    }
  }

  const columns: DataTableColumn<CleanerRow>[] = [
    {
      key: 'fullName',
      header: 'Name',
      render: (row) => <span className="font-medium text-slate-900">{row.fullName}</span>,
    },
    { key: 'phone', header: 'Phone' },
    { key: 'email', header: 'Email' },
    {
      key: 'team',
      header: 'Team',
      render: (row) => row.team?.name ?? '—',
    },
  ];

  const rows: CleanerRow[] = data?.cleaners ?? [];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Cleaners"
        actions={
          <Button type="button" onClick={openCreateForm}>
            + New Cleaner
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        emptyMessage="No cleaners."
        loading={loading}
        error={error ? 'Unable to load cleaners.' : undefined}
        onRowClick={(row) => openDetail(row.id)}
      />

      <FormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Add cleaner"
        onSubmit={handleCreateSubmit}
        submitLabel={creating ? 'Creating…' : 'Add cleaner'}
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
          label="Phone"
          name="new-phone"
          required
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
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
          label="Notes"
          name="new-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
        {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
      </FormDialog>

      {activeId ? (
        <CleanerDetailDrawer id={activeId} onClose={closeDetail} onSaved={() => void refetch()} />
      ) : null}
    </div>
  );
}

function CleanerDetailDrawer({
  id,
  onClose,
  onSaved,
}: {
  id: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data, loading, error, refetch } = useCleanerQuery({
    variables: { id },
    fetchPolicy: 'network-only',
  });

  const title = data?.cleaner?.fullName ?? 'Cleaner';

  return (
    <DetailDrawer open onClose={onClose} title={title}>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message="Unable to load cleaner." />
      ) : !data?.cleaner ? (
        <p className="text-sm text-slate-700">Cleaner not found.</p>
      ) : (
        <div className="flex flex-col gap-8">
          <CleanerEditForm cleaner={data.cleaner} refetch={refetch} onSaved={onSaved} />
          <CleanerTeamAssignment cleaner={data.cleaner} refetch={refetch} onSaved={onSaved} />
        </div>
      )}
    </DetailDrawer>
  );
}

function CleanerEditForm({
  cleaner,
  refetch,
  onSaved,
}: {
  cleaner: CleanerDetail;
  refetch: () => Promise<unknown>;
  onSaved: () => void;
}) {
  const [updateCleaner, { loading: updating }] = useUpdateCleanerMutation();
  const { success } = useToast();

  const [fullName, setFullName] = useState(cleaner.fullName);
  const [phone, setPhone] = useState(cleaner.phone);
  const [email, setEmail] = useState(cleaner.email);
  const [notes, setNotes] = useState(cleaner.notes ?? '');
  const [formError, setFormError] = useState<string | undefined>(undefined);

  useEffect(() => {
    setFullName(cleaner.fullName);
    setPhone(cleaner.phone);
    setEmail(cleaner.email);
    setNotes(cleaner.notes ?? '');
  }, [cleaner.fullName, cleaner.phone, cleaner.email, cleaner.notes]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    try {
      await updateCleaner({
        variables: {
          id: cleaner.id,
          input: {
            fullName,
            phone,
            email,
            notes: notes.trim() === '' ? null : notes,
          },
        },
      });
      await refetch();
      onSaved();
      success('Cleaner updated.');
    } catch {
      setFormError('Unable to update cleaner.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-slate-900">Cleaner details</h3>
      <FormField
        label="Full name"
        name="fullName"
        required
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
      />
      <FormField
        label="Phone"
        name="phone"
        required
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
      />
      <FormField
        label="Email"
        name="email"
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <FormField label="Notes" name="notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
      {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
      <Button type="submit" disabled={updating}>
        {updating ? 'Saving…' : 'Save cleaner'}
      </Button>
    </form>
  );
}

// Ported from the pre-migration `cleaners/[id]/page.tsx`'s "Team" section —
// a `<select>` populated from `useTeamsQuery` that assigns the cleaner to a
// team via `useAssignCleanerToTeamMutation`. Kept as its own always-visible
// inline section (not a nested `FormDialog`) for the same Escape-key
// double-close reason documented on `CustomerProperties` in
// `app/app/customers/page.tsx` — there must be exactly one dialog
// (the drawer itself) open at a time.
function CleanerTeamAssignment({
  cleaner,
  refetch,
  onSaved,
}: {
  cleaner: CleanerDetail;
  refetch: () => Promise<unknown>;
  onSaved: () => void;
}) {
  const { data: teamsData } = useTeamsQuery({ fetchPolicy: 'network-only' });
  const [assignCleanerToTeam, { loading: assigning }] = useAssignCleanerToTeamMutation();
  const { success } = useToast();
  const [teamAssignError, setTeamAssignError] = useState<string | undefined>(undefined);

  async function handleTeamChange(event: ChangeEvent<HTMLSelectElement>) {
    const teamId = event.currentTarget.value;
    if (teamId === '') return;
    setTeamAssignError(undefined);
    try {
      await assignCleanerToTeam({ variables: { cleanerId: cleaner.id, teamId } });
      await refetch();
      onSaved();
      success('Team assignment updated.');
    } catch {
      setTeamAssignError('Unable to assign team.');
    }
  }

  const teams = teamsData?.teams ?? [];

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">Team</h3>
      <p className="mb-4 text-sm text-slate-700">Current team: {cleaner.team?.name ?? 'Unassigned'}</p>
      <label htmlFor="team-select" className="mb-1 block text-sm font-medium text-slate-700">
        Assign to team
      </label>
      <select
        id="team-select"
        name="team-select"
        className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        value={cleaner.team?.id ?? ''}
        disabled={assigning}
        onChange={handleTeamChange}
      >
        <option value="">Unassigned</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
      {teamAssignError ? <p className="mt-2 text-sm text-red-600">{teamAssignError}</p> : null}
    </div>
  );
}
