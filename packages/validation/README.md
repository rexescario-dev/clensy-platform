# @clensy/validation

Laravel-inspired client-side validation for `apps/web`: rule strings, a shared `field -> string[]` error contract, a React Hook Form resolver, and a normalizer that maps a failed GraphQL mutation onto that same contract. See [the design spec](../../docs/superpowers/specs/2026-09-15-clensy-validation-design.md) for the full architecture and rationale.

**Boundary this package enforces:** `@clensy/ui`'s `FormField`/`FormDialog` stay presentation-only — they take a plain `error?: string`/`label`/`title` and never import React Hook Form or a validation engine. `react-hook-form` and `@clensy/validation` live in `apps/web`; `@clensy/ui` has no dependency on either.

## Declaring rules

A rule string is pipe-separated: `ruleName` or `ruleName:param1,param2`. Rules apply to the whole form-values object (not one field at a time), so cross-field rules can read sibling values.

```ts
import type { Rules } from '@clensy/validation';

interface CreateCustomerFormValues {
  fullName: string;
  email: string;
  phone: string;
  notes?: string;
}

const createCustomerRules = {
  fullName: 'required|string',
  email: 'required|email',
  phone: 'required|string',
  notes: 'nullable|string',
} satisfies Rules<CreateCustomerFormValues>;
```

Full rule set: `required`, `nullable`, `string`, `integer`, `numeric`, `boolean`, `array`, `email`, `url`, `min`, `max`, `between`, `in`, `not_in`, `same`, `different`, `required_if`, `required_unless`, `required_with`, `required_without`. An empty value (`undefined`/`null`/`''`) short-circuits: `required` (or a satisfied conditional-required rule) emits exactly one `required` message and nothing else runs for that field; otherwise the field is valid and nothing else runs either — an optional field is never checked against, say, `email` when it's left blank.

## Wiring a form

```tsx
import { clensyResolver } from '@clensy/validation';
import { FormField, FormDialog } from '@clensy/ui';
import { useForm } from 'react-hook-form';

const form = useForm<CreateCustomerFormValues>({
  resolver: clensyResolver<CreateCustomerFormValues>(createCustomerRules),
});

// <FormDialog onSubmit={form.handleSubmit(onValid)} ...> — FormDialog needs
// no changes; its onSubmit prop already accepts RHF's handleSubmit output.

<FormField
  label="Email"
  error={form.formState.errors.email?.message}
  {...form.register('email')}
/>;
```

## Normalizing a failed mutation

`normalizeApiValidationErrors(error, knownFields)` returns a `FieldErrors` map when it recognizes `error` as a field-level validation failure, or `undefined` for anything else (network error, auth failure, an unrecognized shape) — keep your existing generic fallback message for the `undefined` case:

```ts
try {
  await createCustomer({ variables: { input: values } });
} catch (err) {
  const fieldErrors = normalizeApiValidationErrors(err, ['fullName', 'email', 'phone', 'notes']);
  if (fieldErrors) {
    for (const [field, messages] of Object.entries(fieldErrors)) {
      form.setError(field as keyof CreateCustomerFormValues, { type: 'server', message: messages[0] });
    }
  } else {
    setFormError('Unable to create customer.');
  }
}
```

The normalizer's parsing logic is written against a real captured GraphQL response (`src/__fixtures__/create-customer-validation-error.json`), not an assumed wire shape — see the design spec §4.5 for why, and for what to do if a different API surface's error shape turns out to differ.

## Worked example

`apps/web/app/app/customers/page.tsx`'s Add Customer dialog is the reference migration — the only form in `apps/web` using this package so far.

## Messages today are fixed English

`messages.ts` ships default Laravel-style templates (`"The :attribute field is required."`) — this package does not import `next-intl` or produce ICU message keys. `apps/web` has an [Accepted i18n architecture](../../docs/superpowers/specs/2026-09-13-web-i18n-architecture-design.md) with a forward `validation.<rule>` catalog contract this package is designed to compose with later; wiring that up is a future slice, not something this package does today (see the design spec §6).
