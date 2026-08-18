'use client';

import { useCreateTeamMutation, useTeamQuery, useTeamsQuery } from '@clensy/client';
import {
  Button,
  DataTable,
  DetailDrawer,
  ErrorState,
  FormDialog,
  FormField,
  LoadingState,
  PageHeader,
} from '@clensy/ui';
import type { DataTableColumn } from '@clensy/ui';
import { Suspense, useState } from 'react';
import { useDetailDrawer } from '../../../../lib/use-detail-drawer';

// `DataTable<T>` (packages/ui) constrains `T extends Record<string, unknown>`
// — the index signature below satisfies that constraint while keeping the
// named fields concretely typed.
type TeamRow = {
  id: string;
  name: string;
  cleaners: { id: string }[];
  [key: string]: unknown;
};

type TeamMemberRow = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  [key: string]: unknown;
};

const memberColumns: DataTableColumn<TeamMemberRow>[] = [
  { key: 'fullName', header: 'Name' },
  { key: 'phone', header: 'Phone' },
  { key: 'email', header: 'Email' },
];

// `useDetailDrawer` reads `useSearchParams()`, which Next.js requires to sit
// under a `<Suspense>` boundary during prerendering (otherwise the whole
// route bails out of static generation with a build-time warning/error).
// The default export supplies that boundary; `TeamsPageContent` holds the
// actual page — list, create dialog, and detail drawer. This page owns its
// own `?detail=` param independently of `/app/cleaners` (Task 7 brief: "each
// list page owns its own `detail` param independently — there is no
// cross-page drawer state").
export default function TeamsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <TeamsPageContent />
    </Suspense>
  );
}

function TeamsPageContent() {
  const { data, loading, error, refetch } = useTeamsQuery({ fetchPolicy: 'network-only' });
  const [createTeam, { loading: creating }] = useCreateTeamMutation();
  const { activeId, open: openDetail, close: closeDetail } = useDetailDrawer();

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [formError, setFormError] = useState<string | undefined>(undefined);

  function resetForm() {
    setName('');
    setFormError(undefined);
  }

  function openCreateForm() {
    resetForm();
    setFormOpen(true);
  }

  async function handleCreateSubmit() {
    setFormError(undefined);
    try {
      await createTeam({ variables: { input: { name } } });
      setFormOpen(false);
      resetForm();
      await refetch();
    } catch {
      setFormError('Unable to create team.');
    }
  }

  const columns: DataTableColumn<TeamRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => <span className="font-medium text-slate-900">{row.name}</span>,
    },
    {
      key: 'memberCount',
      header: 'Members',
      render: (row) => row.cleaners.length,
    },
  ];

  const rows: TeamRow[] = data?.teams ?? [];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Teams"
        actions={
          <Button type="button" onClick={openCreateForm}>
            + New Team
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        emptyMessage="No teams."
        loading={loading}
        error={error ? 'Unable to load teams.' : undefined}
        onRowClick={(row) => openDetail(row.id)}
      />

      <FormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Add team"
        onSubmit={handleCreateSubmit}
        submitLabel={creating ? 'Creating…' : 'Add team'}
        submitting={creating}
      >
        <FormField
          label="Name"
          name="new-name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
      </FormDialog>

      {activeId ? <TeamDetailDrawer id={activeId} onClose={closeDetail} /> : null}
    </div>
  );
}

// Read-only: there is no update-team mutation anywhere in this codebase (the
// old `cleaners/teams/[id]/page.tsx` never had one either), so this drawer
// deliberately has no edit form and no save button — just the team's name as
// a heading and a `DataTable` of its members, matching the old page exactly.
function TeamDetailDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, loading, error } = useTeamQuery({
    variables: { id },
    fetchPolicy: 'network-only',
  });

  const title = data?.team?.name ?? 'Team';

  return (
    <DetailDrawer open onClose={onClose} title={title}>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message="Unable to load team." />
      ) : !data?.team ? (
        <p className="text-sm text-slate-700">Team not found.</p>
      ) : (
        <div className="flex flex-col gap-6">
          <div>
            <h3 className="mb-4 text-sm font-semibold text-slate-900">Members</h3>
            <DataTable
              columns={memberColumns}
              rows={data.team.cleaners}
              rowKey={(row) => row.id}
              emptyMessage="No members."
            />
          </div>
        </div>
      )}
    </DetailDrawer>
  );
}
