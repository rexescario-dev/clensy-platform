'use client';

import { Button, Field, FieldError, FieldGroup, FieldLabel, Input } from '@clensy/ui';
import { clensyResolver, type Rules } from '@clensy/validation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useClensyTranslations } from '../i18n/use-clensy-translations';
import { resolveMessage } from '../i18n/resolve-message';

export interface LoginFormValues {
  email: string;
  password: string;
}

export interface LoginFormProps {
  errorMessage?: string;
  onLogin: (values: LoginFormValues) => Promise<void>;
}

// Client-side format validation only (required / email syntax / a 255-char
// UX ceiling) — mirrors LoginInput's own class-validator constraints
// (@IsEmail, @IsString + @IsNotEmpty). The max:255 bound is a client-only
// addition, not derived from the backend — LoginInput has no length
// constraint. This MUST NOT become a way to distinguish *why* a login
// failed: an invalid/empty/too-long field is caught before submission, but
// once the mutation actually runs, a failure is always the single generic
// message the caller passes as `errorMessage`, never a field-level error —
// unknown email, wrong password, and disabled account are all
// indistinguishable here (see `onValid`'s single `catch`, below).
const loginRules = {
  email: 'required|email|max:255',
  password: 'required|string|max:255',
} satisfies Rules<LoginFormValues>;

export function LoginForm({ errorMessage, onLogin }: LoginFormProps) {
  const t = useClensyTranslations('auth');
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<LoginFormValues>({
    resolver: clensyResolver<LoginFormValues>(loginRules, {
      attributes: { email: t('email').toLowerCase(), password: t('password').toLowerCase() },
    }),
  });

  async function onValid(values: LoginFormValues) {
    setError(undefined);
    setSubmitting(true);
    try {
      await onLogin(values);
    } catch {
      setError(resolveMessage(errorMessage, t('error')));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(onValid)}
      className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h1 className="text-lg font-semibold text-slate-900">{t('title')}</h1>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">{t('email')}</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            aria-invalid={form.formState.errors.email ? true : undefined}
            aria-describedby={form.formState.errors.email ? 'email-error' : undefined}
            {...form.register('email')}
          />
          {form.formState.errors.email ? (
            <FieldError id="email-error">{form.formState.errors.email.message}</FieldError>
          ) : null}
        </Field>
        <Field>
          <FieldLabel htmlFor="password">{t('password')}</FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={form.formState.errors.password ? true : undefined}
            aria-describedby={form.formState.errors.password ? 'password-error' : undefined}
            {...form.register('password')}
          />
          {form.formState.errors.password ? (
            <FieldError id="password-error">{form.formState.errors.password.message}</FieldError>
          ) : null}
        </Field>
      </FieldGroup>
      {error !== undefined ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={submitting}>
        {submitting ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}
