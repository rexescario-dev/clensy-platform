'use client';

import { LoginForm, type LoginFormValues } from '@clensy/web';
import { useLoginMutation } from '@clensy/client';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [login] = useLoginMutation();

  // Spec §4.5 / §3: on success the API has already set the HttpOnly
  // session cookie via `Set-Cookie` on the mutation response — this page
  // never reads or writes the cookie itself, it only redirects. `LoginForm`
  // resolves on success and rejects on failure, so a falsy
  // `result.data?.login.success` (which Apollo doesn't otherwise treat as an
  // error) is turned into an explicit throw to signal failure up to
  // `LoginForm`, which is what displays the generic error message.
  async function handleLogin(values: LoginFormValues) {
    const result = await login({ variables: { loginInput: values } });
    if (!result.data?.login.success) {
      throw new Error('Login failed');
    }
    router.push('/app');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <LoginForm
        labels={{
          email: t('email'),
          password: t('password'),
          submit: t('submit'),
          submitting: t('submitting'),
          title: t('title'),
        }}
        onLogin={handleLogin}
      />
    </main>
  );
}
