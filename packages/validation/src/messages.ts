import type { ValidateOptions } from './types';

const DEFAULT_MESSAGES: Record<string, string> = {
  array: 'The :attribute must be an array.',
  between: 'The :attribute must be between :param0 and :param1.',
  boolean: 'The :attribute field must be true or false.',
  different: 'The :attribute and :param0 must be different.',
  email: 'The :attribute must be a valid email address.',
  in: 'The selected :attribute is invalid.',
  integer: 'The :attribute must be an integer.',
  max: 'The :attribute must not be greater than :param0.',
  min: 'The :attribute must be at least :param0.',
  not_in: 'The selected :attribute is invalid.',
  numeric: 'The :attribute must be a number.',
  required: 'The :attribute field is required.',
  same: 'The :attribute and :param0 must match.',
  string: 'The :attribute must be a string.',
  url: 'The :attribute must be a valid URL.',
};

export function formatMessage(
  ruleName: string,
  field: string,
  params: string[],
  options?: ValidateOptions,
): string {
  const template = options?.messages?.[ruleName] ?? DEFAULT_MESSAGES[ruleName];
  if (template === undefined) {
    throw new Error(`No default message registered for rule "${ruleName}"`);
  }
  const attribute = options?.attributes?.[field] ?? humanize(field);
  let message = template.replace(/:attribute/g, attribute);
  params.forEach((param, index) => {
    message = message.replace(new RegExp(`:param${index}`, 'g'), param);
  });
  return message;
}

function humanize(field: string): string {
  return field.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
}
