'use client';

import { useReceiveLaundryOrderMutation } from '@clensy/client';
import { FormDialog } from '@clensy/ui';
import { clensyResolver, normalizeApiValidationErrors, type Rules } from '@clensy/validation';
import {
  LaundryCustomerPicker,
  LaundryFulfillmentFieldset,
  useClensyTranslations,
  type LaundryFulfillmentType,
} from '@clensy/web';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useLaundryCustomerSearch } from '../../lib/use-laundry-customer-search';

interface CreateLaundryOrderFormValues {
  customerId: string;
  fulfillmentType: LaundryFulfillmentType;
}

export interface CreateLaundryOrderDialogProps {
  onClose: () => void;
  onCreated: (orderId: string) => void;
  open: boolean;
  showAddCustomerLink: boolean;
}

const DEFAULT_VALUES: CreateLaundryOrderFormValues = { customerId: '', fulfillmentType: 'PICKUP' };

const RULES = {
  customerId: 'required',
  fulfillmentType: 'required|in:DELIVERY,PICKUP',
} satisfies Rules<CreateLaundryOrderFormValues>;

const API_FIELDS: (keyof CreateLaundryOrderFormValues)[] = ['customerId', 'fulfillmentType'];

// The laundry intake form (lifecycle spec §8.4.4, #160): a customer found by
// server-side search and a fulfillment chosen once. The page owns opening,
// remounting per opening (which resets the form, search, alert and guard),
// and what happens after a create. Creating a customer here is out of
// scope (§8.2, §8.6); the optional link leaves for the customers page.
export function CreateLaundryOrderDialog({ onClose, onCreated, open, showAddCustomerLink }: CreateLaundryOrderDialogProps) {
  const t = useClensyTranslations('laundry');
  const [receive, { loading: creating }] = useReceiveLaundryOrderMutation();
  const form = useForm<CreateLaundryOrderFormValues>({
    defaultValues: DEFAULT_VALUES,
    // Each field's whole sentence is its `:attribute`, so the `required`
    // and `in` templates print the catalog copy ("Select a customer.").
    resolver: clensyResolver<CreateLaundryOrderFormValues>(RULES, {
      attributes: {
        customerId: t('create.customer.required'),
        fulfillmentType: t('create.fulfillment.required'),
      },
      messages: { in: ':attribute', required: ':attribute' },
    }),
  });
  const [customerQuery, setCustomerQuery] = useState('');
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const search = useLaundryCustomerSearch(customerQuery);
  const inFlight = useRef(false);
  const submitting = creating || form.formState.isSubmitting;
  const validateAndCreate = form.handleSubmit(handleValid);

  // Taken synchronously before validation and released when the attempt
  // settles. A second submit fired before React re-renders (and disables
  // the buttons) is dropped, and a failed attempt can be retried.
  async function handleSubmit() {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await validateAndCreate();
    } finally {
      inFlight.current = false;
    }
  }

  async function handleValid(values: CreateLaundryOrderFormValues) {
    setFormError(undefined);
    let orderId: string | undefined;
    try {
      const result = await receive({ variables: { input: values } });
      orderId = result.data?.receiveLaundryOrder.id;
    } catch (error) {
      const fieldErrors = normalizeApiValidationErrors(error, API_FIELDS);
      if (fieldErrors) {
        for (const [field, messages] of Object.entries(fieldErrors)) {
          form.setError(field as keyof CreateLaundryOrderFormValues, { message: messages[0], type: 'server' });
        }
        // Every error is set before focus moves (#181). Focus goes to the
        // first field in form order, whatever order the server listed them
        // in. Landing there reads the field, its invalid state and its
        // error, once; field errors carry no live role. `fieldErrors` holds
        // only `API_FIELDS` keys (the normalizer drops unknown fields), and
        // the search runs over `API_FIELDS`, so only a form field is focused.
        const first = API_FIELDS.find((field) => field in fieldErrors);
        if (first) form.setFocus(first);
      } else {
        setFormError(t('create.failure'));
      }
      return;
    }
    if (orderId) {
      onCreated(orderId);
      return;
    }
    // The request succeeded but did not name the order. It may exist, so
    // the user is asked to check the list instead of being invited to
    // create it again.
    setFormError(t('create.unconfirmed'));
  }

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={t('create.title')}
      onSubmit={handleSubmit}
      submitLabel={submitting ? t('create.creating') : t('create.submit')}
      submitting={submitting}
    >
      <Controller
        control={form.control}
        name="customerId"
        render={({ field, fieldState }) => (
          <LaundryCustomerPicker
            id="laundry-customer"
            inputRef={field.ref}
            query={customerQuery}
            options={search.options}
            status={search.status}
            truncated={search.truncated}
            error={fieldState.error?.message}
            // A user edit drops any selection: the input must name the
            // customer the order is created for (picker selection contract).
            onQueryChange={(text) => {
              setCustomerQuery(text);
              if (field.value !== '') field.onChange('');
            }}
            // The chosen name is shown without going through
            // `onQueryChange`, so it does not clear the selection.
            onSelect={(option) => {
              setCustomerQuery(option.fullName);
              field.onChange(option.id);
            }}
          />
        )}
      />
      {showAddCustomerLink ? (
        <Link
          href="/app/customers"
          className="self-start text-sm text-slate-700 underline focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          {t('create.addCustomer')}
        </Link>
      ) : null}
      <Controller
        control={form.control}
        name="fulfillmentType"
        render={({ field, fieldState }) => (
          <LaundryFulfillmentFieldset
            name="laundry-fulfillment"
            inputRef={field.ref}
            value={field.value}
            error={fieldState.error?.message}
            onChange={field.onChange}
          />
        )}
      />
      {formError ? (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      ) : null}
    </FormDialog>
  );
}
