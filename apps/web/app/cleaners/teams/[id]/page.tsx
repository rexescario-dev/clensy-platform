'use client';

import { useTeamQuery } from '@clensy/client';
import { DataTable } from '@clensy/ui';
import type { DataTableColumn } from '@clensy/ui';
import { useParams } from 'next/navigation';

// `DataTable<T>` (packages/ui) constrains `T extends Record<string, unknown>`
// — the index signature below satisfies that constraint while keeping the
// named fields concretely typed.
type TeamCleanerRow = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  [key: string]: unknown;
};

const columns: DataTableColumn<TeamCleanerRow>[] = [
  { key: 'fullName', header: 'Name' },
  { key: 'phone', header: 'Phone' },
  { key: 'email', header: 'Email' },
];

export default function TeamDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data, loading, error } = useTeamQuery({
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
        <p className="text-sm text-red-600">Unable to load team.</p>
      </main>
    );
  }

  if (!data?.team) {
    return (
      <main className="p-6">
        <p className="text-sm text-slate-700">Team not found.</p>
      </main>
    );
  }

  const team = data.team;

  return (
    <main className="flex flex-col gap-8 p-6">
      <h1 className="text-lg font-semibold text-slate-900">{team.name}</h1>

      <section>
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Members</h2>
        <DataTable columns={columns} rows={team.cleaners} rowKey={(row) => row.id} emptyMessage="No members." />
      </section>
    </main>
  );
}
