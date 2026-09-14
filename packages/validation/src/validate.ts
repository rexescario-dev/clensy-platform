import { formatMessage } from './messages';
import { CONDITIONAL_REQUIRED_RULES, isEmpty, isRequiredByCondition, parseRuleString, RULE_VALIDATORS } from './rules';
import type { FieldErrors, Rules, ValidateOptions } from './types';

export function validate<T extends object>(
  values: T,
  rules: Rules<T>,
  options?: ValidateOptions,
): FieldErrors {
  const errors: FieldErrors = {};
  const valuesRecord = values as Record<string, unknown>;

  for (const field of Object.keys(rules)) {
    const ruleString = (rules as Record<string, string | undefined>)[field];
    if (!ruleString) {
      continue;
    }

    const parsed = parseRuleString(ruleString);
    const value = valuesRecord[field];
    const empty = isEmpty(value);

    const explicitlyRequired = parsed.some((rule) => rule.name === 'required');
    const conditionallyRequired = parsed
      .filter((rule) => CONDITIONAL_REQUIRED_RULES.has(rule.name))
      .some((rule) => isRequiredByCondition(rule.name, rule.params, valuesRecord));
    const isRequired = explicitlyRequired || conditionallyRequired;

    if (empty) {
      if (isRequired) {
        errors[field] = [formatMessage('required', field, [], options)];
      }
      continue;
    }

    const messages: string[] = [];
    for (const { name, params } of parsed) {
      if (name === 'required' || name === 'nullable' || CONDITIONAL_REQUIRED_RULES.has(name)) {
        continue;
      }
      const validator = RULE_VALIDATORS[name];
      if (!validator(value, params, valuesRecord)) {
        messages.push(formatMessage(name, field, params, options));
      }
    }

    if (messages.length > 0) {
      errors[field] = messages;
    }
  }

  return errors;
}
