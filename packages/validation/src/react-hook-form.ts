import type { FieldError, FieldErrors as RHFFieldErrors, FieldValues, Resolver } from 'react-hook-form';
import type { Rules, ValidateOptions } from './types';
import { validate } from './validate';

export function clensyResolver<T extends FieldValues>(
  rules: Rules<T>,
  options?: ValidateOptions,
): Resolver<T> {
  return async (values) => {
    const errors = validate(values, rules, options);

    if (Object.keys(errors).length === 0) {
      return { values, errors: {} };
    }

    const fieldErrors: Record<string, FieldError> = {};
    for (const [field, messages] of Object.entries(errors)) {
      fieldErrors[field] = { type: 'validation', message: messages[0] };
    }

    return { values: {}, errors: fieldErrors as RHFFieldErrors<T> };
  };
}
