'use client';

import { useLoginMutation } from '@clensy/client';
import { Button, FormField } from '@clensy/ui';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

// Spec §4.8 / §4.3: on success the API has already set the HttpOnly session
// cookie via `Set-Cookie` on the mutation response — this page never reads
// or writes the cookie itself, it only redirects. On failure the API
// returns one generic, non-discriminating error message (unknown email,
// wrong password, and disabled account are all indistinguishable) — this
// page mirrors that by not attempting to interpret the error, just
// displaying a fixed generic message.
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [login, { loading }] = useLoginMutation();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    try {
      const result = await login({ variables: { loginInput: { email, password } } });
      if (result.data?.login.success) {
        router.push('/admin');
        return;
      }
      setError('Invalid email or password.');
    } catch {
      setError('Invalid email or password.');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-lg font-semibold text-slate-900">Clensy Admin Login</h1>
        <FormField
          label="Email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </main>
  );
}
