'use client';

import {
  useAssignCleanerToTeamMutation,
  useCleanerQuery,
  useTeamsQuery,
  useUpdateCleanerMutation,
} from '@clensy/client';
import { Button, FormField } from '@clensy/ui';
import { useParams } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

export default function CleanerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data, loading, error, refetch } = useCleanerQuery({
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
        <p className="text-sm text-red-600">Unable to load cleaner.</p>
      </main>
    );
  }

  if (!data?.cleaner) {
    return (
      <main className="p-6">
        <p className="text-sm text-slate-700">Cleaner not found.</p>
      </main>
    );
  }

  return <CleanerDetail id={id} cleaner={data.cleaner} refetch={refetch} />;
}

function CleanerDetail({
  id,
  cleaner,
  refetch,
}: {
  id: string;
  cleaner: {
    id: string;
    fullName: string;
    phone: string;
    email: string;
    notes: string | null;
    team: { id: string; name: string } | null;
  };
  refetch: () => Promise<unknown>;
}) {
  const [updateCleaner, { loading: updatingCleaner }] = useUpdateCleanerMutation();
  const { data: teamsData } = useTeamsQuery({ fetchPolicy: 'network-only' });
  const [assignCleanerToTeam, { loading: assigning }] = useAssignCleanerToTeamMutation();

  // --- Cleaner edit form ---
  const [fullName, setFullName] = useState(cleaner.fullName);
  const [phone, setPhone] = useState(cleaner.phone);
  const [email, setEmail] = useState(cleaner.email);
  const [notes, setNotes] = useState(cleaner.notes ?? '');
  const [cleanerFormError, setCleanerFormError] = useState<string | undefined>(undefined);

  useEffect(() => {
    setFullName(cleaner.fullName);
    setPhone(cleaner.phone);
    setEmail(cleaner.email);
    setNotes(cleaner.notes ?? '');
  }, [cleaner.fullName, cleaner.phone, cleaner.email, cleaner.notes]);

  async function handleCleanerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCleanerFormError(undefined);
    try {
      await updateCleaner({
        variables: {
          id,
          input: {
            fullName,
            phone,
            email,
            notes: notes.trim() === '' ? null : notes,
          },
        },
      });
      await refetch();
    } catch {
      setCleanerFormError('Unable to update cleaner.');
    }
  }

  // --- Team assignment ---
  const [teamAssignError, setTeamAssignError] = useState<string | undefined>(undefined);

  async function handleTeamChange(event: FormEvent<HTMLSelectElement>) {
    const teamId = event.currentTarget.value;
    if (teamId === '') return;
    setTeamAssignError(undefined);
    try {
      await assignCleanerToTeam({ variables: { cleanerId: id, teamId } });
      await refetch();
    } catch {
      setTeamAssignError('Unable to assign team.');
    }
  }

  const teams = teamsData?.teams ?? [];

  return (
    <main className="flex flex-col gap-8 p-6">
      <h1 className="text-lg font-semibold text-slate-900">{cleaner.fullName}</h1>

      <section className="max-w-sm rounded-lg border border-slate-200 p-4">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Cleaner details</h2>
        <form onSubmit={handleCleanerSubmit} className="flex flex-col gap-4">
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
          {cleanerFormError ? <p className="text-sm text-red-600">{cleanerFormError}</p> : null}
          <Button type="submit" disabled={updatingCleaner}>
            {updatingCleaner ? 'Saving…' : 'Save cleaner'}
          </Button>
        </form>
      </section>

      <section className="max-w-sm rounded-lg border border-slate-200 p-4">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Team</h2>
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
      </section>
    </main>
  );
}
