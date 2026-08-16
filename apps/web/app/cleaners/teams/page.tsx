'use client';

import { useCreateTeamMutation, useTeamsQuery } from '@clensy/client';
import { Button, DataTable, FormField } from '@clensy/ui';
import type { DataTableColumn } from '@clensy/ui';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';

// `DataTable<T>` (packages/ui) constrains `T extends Record<string, unknown>`
// — the index signature below satisfies that constraint while keeping the
// named fields concretely typed.
type TeamRow = {
  id: string;
  name: string;
  cleaners: { id: string }[];
  [key: string]: unknown;
};

export default function TeamsPage() {
  const { data, loading, error, refetch } = useTeamsQuery({ fetchPolicy: 'network-only' });
  const [createTeam, { loading: creating }] = useCreateTeamMutation();

  const [name, setName] = useState('');
  const [formError, setFormError] = useState<string | undefined>(undefined);

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    try {
      await createTeam({ variables: { input: { name } } });
      setName('');
      await refetch();
    } catch {
      setFormError('Unable to create team.');
    }
  }

  const columns: DataTableColumn<TeamRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <Link
          href={`/cleaners/teams/${row.id}`}
          className="font-medium text-slate-900 underline-offset-2 hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: 'memberCount',
      header: 'Members',
      render: (row) => row.cleaners.length,
    },
  ];

  const rows: TeamRow[] = data?.teams ?? [];

  return (
    <main className="flex flex-col gap-8 p-6">
      <h1 className="text-lg font-semibold text-slate-900">Teams</h1>

      <section>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-600">Unable to load teams.</p>
        ) : (
          <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} emptyMessage="No teams." />
        )}
      </section>

      <section className="max-w-sm rounded-lg border border-slate-200 p-4">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Add team</h2>
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
          <FormField
            label="Name"
            name="new-name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          <Button type="submit" disabled={creating}>
            {creating ? 'Creating…' : 'Add team'}
          </Button>
        </form>
      </section>
    </main>
  );
}
