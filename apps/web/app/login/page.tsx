'use client';

import { useLoginMutation } from '@clensy/client';
import { Button, FormField } from '@clensy/ui';
import { clensyResolver, type Rules } from '@clensy/validation';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

// Client-side format validation only (required / email syntax / a 255-char
// UX ceiling) — mirrors LoginInput's own class-validator constraints
// (@IsEmail, @IsString + @IsNotEmpty). The max:255 bound is a client-only
// addition, not derived from the backend — LoginInput has no length
// constraint. This MUST NOT become a way to distinguish *why* a login
// failed: an invalid/empty/too-long field is caught before submission, but
// once the mutation actually runs, a failure is always the single generic
// message below, never a field-level error. Unknown email, wrong password,
// and disabled account remain indistinguishable, per spec.
interface LoginFormValues {
  email: string;
  password: string;
}

const loginRules = {
  email: 'required|email|max:255',
  password: 'required|string|max:255',
} satisfies Rules<LoginFormValues>;

// Spec §4.8 / §4.3: on success the API has already set the HttpOnly session
// cookie via `Set-Cookie` on the mutation response — this page never reads
// or writes the cookie itself, it only redirects. On failure the API
// returns one generic, non-discriminating error message (unknown email,
// wrong password, and disabled account are all indistinguishable) — this
// page mirrors that by not attempting to interpret the error, just
// displaying the fixed generic translated string.
export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [error, setError] = useState<string | undefined>(undefined);
  const [login, { loading }] = useLoginMutation();
  const form = useForm<LoginFormValues>({
    resolver: clensyResolver<LoginFormValues>(loginRules, {
      attributes: { email: t('email').toLowerCase(), password: t('password').toLowerCase() },
    }),
  });

  async function onValid(values: LoginFormValues) {
    setError(undefined);
    try {
      const result = await login({ variables: { loginInput: values } });
      if (result.data?.login.success) {
        router.push('/app');
        return;
      }
      setError(t('errors.invalidCredentials'));
    } catch {
      setError(t('errors.invalidCredentials'));
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={form.handleSubmit(onValid)}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-lg font-semibold text-slate-900">{t('title')}</h1>
        <FormField
          label={t('email')}
          type="email"
          autoComplete="username"
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />
        <FormField
          label={t('password')}
          type="password"
          autoComplete="current-password"
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />
        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={loading}>
          {loading ? t('submitting') : t('submit')}
        </Button>
      </form>
    </main>
  );
}
