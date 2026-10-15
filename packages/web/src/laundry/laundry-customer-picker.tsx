'use client';

import type { Ref } from 'react';
import { useClensyTranslations } from '../i18n/use-clensy-translations';
import { LaundrySearchCombobox, type LaundrySearchStatus } from './laundry-search-combobox';

export interface LaundryCustomerOption {
  id: string;
  email: string;
  fullName: string;
  phone: string;
}

export type LaundryCustomerSearchStatus = LaundrySearchStatus;

export interface LaundryCustomerPickerProps {
  id: string;
  error?: string;
  inputRef?: Ref<HTMLInputElement>;
  onQueryChange: (text: string) => void;
  onSelect: (option: LaundryCustomerOption) => void;
  options: readonly LaundryCustomerOption[];
  query: string;
  status: LaundryCustomerSearchStatus;
  truncated?: boolean;
}

// The laundry intake customer search (#160). The combobox behavior lives in
// LaundrySearchCombobox (#158); this wrapper supplies the customer copy and
// option text.
export function LaundryCustomerPicker(props: LaundryCustomerPickerProps) {
  const t = useClensyTranslations('laundry');
  return (
    <LaundrySearchCombobox
      {...props}
      copy={{
        empty: t('create.customer.empty'),
        error: t('create.customer.error'),
        label: t('create.customer.label'),
        more: t('create.customer.more'),
        searching: t('create.customer.searching'),
      }}
      renderOption={(option) => (
        <>
          <span className="block text-sm text-slate-900">{option.fullName}</span>
          <span className="block text-sm text-slate-500">{option.phone !== '' ? option.phone : option.email}</span>
        </>
      )}
    />
  );
}
