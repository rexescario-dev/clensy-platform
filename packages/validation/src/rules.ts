export interface ParsedRule {
  name: string;
  params: string[];
}

const KNOWN_RULES = new Set([
  'required',
  'nullable',
  'string',
  'integer',
  'numeric',
  'boolean',
  'array',
  'email',
  'url',
  'min',
  'max',
  'between',
  'in',
  'not_in',
  'same',
  'different',
  'required_if',
  'required_unless',
  'required_with',
  'required_without',
]);

export const CONDITIONAL_REQUIRED_RULES = new Set([
  'required_if',
  'required_unless',
  'required_with',
  'required_without',
]);

export function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

export function isRequiredByCondition(
  ruleName: string,
  params: string[],
  values: Record<string, unknown>,
): boolean {
  switch (ruleName) {
    case 'required_if': {
      const [otherField, expected] = params;
      if (!otherField || expected === undefined) {
        throw new Error('Rule "required_if" requires two parameters: field,value');
      }
      return String(values[otherField]) === expected;
    }
    case 'required_unless': {
      const [otherField, expected] = params;
      if (!otherField || expected === undefined) {
        throw new Error('Rule "required_unless" requires two parameters: field,value');
      }
      return String(values[otherField]) !== expected;
    }
    case 'required_with': {
      if (params.length === 0) {
        throw new Error('Rule "required_with" requires at least one parameter');
      }
      return params.some((field) => !isEmpty(values[field]));
    }
    case 'required_without': {
      if (params.length === 0) {
        throw new Error('Rule "required_without" requires at least one parameter');
      }
      return params.some((field) => isEmpty(values[field]));
    }
    default:
      throw new Error(`"${ruleName}" is not a conditional-required rule`);
  }
}

type RuleValidator = (value: unknown, params: string[], values: Record<string, unknown>) => boolean;

export function parseRuleString(ruleString: string): ParsedRule[] {
  return ruleString.split('|').map((token) => {
    const [name, paramsPart] = token.split(':');
    if (!KNOWN_RULES.has(name)) {
      throw new Error(`Unknown validation rule "${name}"`);
    }
    const params = paramsPart === undefined ? [] : paramsPart.split(',');
    return { name, params };
  });
}

function isNumericString(value: string): boolean {
  return value.trim() !== '' && Number.isFinite(Number(value));
}

function isNumericValue(value: unknown): boolean {
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (typeof value === 'string') {
    return isNumericString(value);
  }
  return false;
}

function numericValueOf(value: unknown): number {
  return typeof value === 'number' ? value : Number(value as string);
}

function parseBound(name: string, raw: string | undefined): number {
  const bound = raw === undefined ? Number.NaN : Number(raw);
  if (raw === undefined || Number.isNaN(bound)) {
    throw new Error(`Invalid parameter for rule "${name}": expected a numeric bound, got "${raw}"`);
  }
  return bound;
}

/**
 * The min/max/between quantity: string length, numeric value (real number or
 * numeric-looking string), or array item count. `undefined` for any other
 * runtime type — callers treat that as a malformed-rule condition (spec §4.2).
 */
function quantityOf(value: unknown): number | undefined {
  if (Array.isArray(value)) {
    return value.length;
  }
  if (isNumericValue(value)) {
    return numericValueOf(value);
  }
  if (typeof value === 'string') {
    return value.length;
  }
  return undefined;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const RULE_VALIDATORS: Record<string, RuleValidator> = {
  required: (value) => !isEmpty(value),

  string: (value) => typeof value === 'string',

  integer: (value) => isNumericValue(value) && Number.isInteger(numericValueOf(value)),

  numeric: (value) => isNumericValue(value),

  boolean: (value) => typeof value === 'boolean' || value === 'true' || value === 'false',

  array: (value) => Array.isArray(value),

  email: (value) => typeof value === 'string' && EMAIL_PATTERN.test(value),

  url: (value) => {
    try {
      new URL(String(value));
      return true;
    } catch {
      return false;
    }
  },

  min: (value, params) => {
    const bound = parseBound('min', params[0]);
    return requireQuantity('min', value) >= bound;
  },

  max: (value, params) => {
    const bound = parseBound('max', params[0]);
    return requireQuantity('max', value) <= bound;
  },

  between: (value, params) => {
    const lower = parseBound('between', params[0]);
    const upper = parseBound('between', params[1]);
    const quantity = requireQuantity('between', value);
    return quantity >= lower && quantity <= upper;
  },

  in: (value, params) => {
    if (params.length === 0) {
      throw new Error('Rule "in" requires at least one parameter');
    }
    return params.includes(String(value));
  },

  not_in: (value, params) => !RULE_VALIDATORS.in(value, params, {}),

  same: (value, params, values) => {
    const [otherField] = params;
    if (!otherField) {
      throw new Error('Rule "same" requires exactly one parameter (the field to compare against)');
    }
    return value === values[otherField];
  },

  different: (value, params, values) => !RULE_VALIDATORS.same(value, params, values),
};

function requireQuantity(name: string, value: unknown): number {
  const quantity = quantityOf(value);
  if (quantity === undefined) {
    throw new Error(`Rule "${name}" cannot be applied to a value of type ${typeof value}`);
  }
  return quantity;
}
