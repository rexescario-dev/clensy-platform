import { describe, expect, it } from 'vitest';
import { parseRuleString, RULE_VALIDATORS, isRequiredByCondition } from './rules';

describe('parseRuleString', () => {
  it('parses a single rule with no params', () => {
    expect(parseRuleString('required')).toEqual([{ name: 'required', params: [] }]);
  });

  it('parses multiple pipe-separated rules', () => {
    expect(parseRuleString('required|email')).toEqual([
      { name: 'required', params: [] },
      { name: 'email', params: [] },
    ]);
  });

  it('parses a rule with comma-separated params', () => {
    expect(parseRuleString('between:1,100')).toEqual([{ name: 'between', params: ['1', '100'] }]);
  });

  it('throws for an unknown rule name', () => {
    expect(() => parseRuleString('emali')).toThrow(Error);
    expect(() => parseRuleString('required|emali')).toThrow(Error);
  });
});

describe('required', () => {
  const required = RULE_VALIDATORS.required;

  it('passes for a non-empty value', () => {
    expect(required('foo', [], {})).toBe(true);
    expect(required(0, [], {})).toBe(true);
    expect(required(false, [], {})).toBe(true);
  });

  it('fails for an empty value', () => {
    expect(required('', [], {})).toBe(false);
    expect(required(null, [], {})).toBe(false);
    expect(required(undefined, [], {})).toBe(false);
  });
});

describe('string', () => {
  const stringRule = RULE_VALIDATORS.string;

  it('passes for a genuine string', () => {
    expect(stringRule('foo', [], {})).toBe(true);
  });

  it('fails for a number', () => {
    expect(stringRule(123, [], {})).toBe(false);
  });

  it('fails for a boolean', () => {
    expect(stringRule(true, [], {})).toBe(false);
  });
});

describe('integer', () => {
  const integer = RULE_VALIDATORS.integer;

  it('passes for a real integer', () => {
    expect(integer(42, [], {})).toBe(true);
  });

  it('passes for an integer-looking string', () => {
    expect(integer('42', [], {})).toBe(true);
  });

  it('fails for a non-integer number', () => {
    expect(integer(4.2, [], {})).toBe(false);
    expect(integer('4.2', [], {})).toBe(false);
  });

  it('fails for a non-numeric string', () => {
    expect(integer('abc', [], {})).toBe(false);
  });
});

describe('numeric', () => {
  const numeric = RULE_VALIDATORS.numeric;

  it('passes for a real number', () => {
    expect(numeric(4.2, [], {})).toBe(true);
  });

  it('passes for a numeric-looking string', () => {
    expect(numeric('4.2', [], {})).toBe(true);
  });

  it('fails for a non-numeric string', () => {
    expect(numeric('abc', [], {})).toBe(false);
  });
});

describe('boolean', () => {
  const booleanRule = RULE_VALIDATORS.boolean;

  it('passes for a real boolean', () => {
    expect(booleanRule(true, [], {})).toBe(true);
    expect(booleanRule(false, [], {})).toBe(true);
  });

  it('passes for the strings "true"/"false"', () => {
    expect(booleanRule('true', [], {})).toBe(true);
    expect(booleanRule('false', [], {})).toBe(true);
  });

  it('fails for anything else', () => {
    expect(booleanRule('yes', [], {})).toBe(false);
    expect(booleanRule(1, [], {})).toBe(false);
  });
});

describe('array', () => {
  const arrayRule = RULE_VALIDATORS.array;

  it('passes for an array', () => {
    expect(arrayRule([1, 2], [], {})).toBe(true);
  });

  it('fails for a non-array', () => {
    expect(arrayRule('foo', [], {})).toBe(false);
    expect(arrayRule({}, [], {})).toBe(false);
  });
});

describe('email', () => {
  const email = RULE_VALIDATORS.email;

  it('passes for a syntactically valid email', () => {
    expect(email('a@b.com', [], {})).toBe(true);
  });

  it('fails for an invalid email', () => {
    expect(email('not-an-email', [], {})).toBe(false);
  });
});

describe('url', () => {
  const url = RULE_VALIDATORS.url;

  it('passes for an http(s) URL', () => {
    expect(url('https://example.com', [], {})).toBe(true);
  });

  it('passes for a non-http scheme (no scheme allow-list)', () => {
    expect(url('mailto:a@b.com', [], {})).toBe(true);
  });

  it('fails for a non-URL string', () => {
    expect(url('not a url', [], {})).toBe(false);
  });
});

describe('min / max / between', () => {
  const min = RULE_VALIDATORS.min;
  const max = RULE_VALIDATORS.max;
  const between = RULE_VALIDATORS.between;

  it('min compares string character length', () => {
    expect(min('hello', ['3'], {})).toBe(true);
    expect(min('hi', ['3'], {})).toBe(false);
  });

  it('min compares numeric value for a number', () => {
    expect(min(5, ['3'], {})).toBe(true);
    expect(min(2, ['3'], {})).toBe(false);
  });

  it('min compares numeric value for a numeric-looking string', () => {
    expect(min('5', ['3'], {})).toBe(true);
    expect(min('2', ['3'], {})).toBe(false);
  });

  it('min compares array item count', () => {
    expect(min([1, 2, 3], ['3'], {})).toBe(true);
    expect(min([1], ['3'], {})).toBe(false);
  });

  it('max is the inverse comparison', () => {
    expect(max('hi', ['3'], {})).toBe(true);
    expect(max('hello', ['3'], {})).toBe(false);
  });

  it('between is inclusive on both bounds', () => {
    expect(between(1, ['1', '5'], {})).toBe(true);
    expect(between(5, ['1', '5'], {})).toBe(true);
    expect(between(3, ['1', '5'], {})).toBe(true);
    expect(between(0, ['1', '5'], {})).toBe(false);
    expect(between(6, ['1', '5'], {})).toBe(false);
  });

  it('throws for a malformed between (missing bound)', () => {
    expect(() => between(3, ['1'], {})).toThrow(Error);
  });

  it('throws for a malformed min (non-numeric bound)', () => {
    expect(() => min(3, ['abc'], {})).toThrow(Error);
  });

  it('throws when applied to an unsupported runtime type', () => {
    expect(() => min(true, ['3'], {})).toThrow(Error);
    expect(() => min({}, ['3'], {})).toThrow(Error);
  });
});

describe('in / not_in', () => {
  const inRule = RULE_VALIDATORS.in;
  const notIn = RULE_VALIDATORS.not_in;

  it('compares String(value) strictly against each parameter — a numeric 1 and string "1" both pass in:1,2', () => {
    expect(inRule(1, ['1', '2'], {})).toBe(true);
    expect(inRule('1', ['1', '2'], {})).toBe(true);
  });

  it('fails for a value that stringifies differently, even if numerically equal', () => {
    expect(inRule('1 ', ['1', '2'], {})).toBe(false);
    expect(inRule(10, ['1', '2'], {})).toBe(false);
  });

  it('not_in is the exact negation', () => {
    expect(notIn(1, ['1', '2'], {})).toBe(false);
    expect(notIn(3, ['1', '2'], {})).toBe(true);
  });

  it('throws when no parameters are given', () => {
    expect(() => inRule('1', [], {})).toThrow(Error);
  });
});

describe('same / different', () => {
  const same = RULE_VALIDATORS.same;
  const different = RULE_VALIDATORS.different;

  it('same passes only for strict equality against the named sibling field', () => {
    expect(same('a', ['other'], { other: 'a' })).toBe(true);
    expect(same('a', ['other'], { other: 'b' })).toBe(false);
    expect(same(1, ['other'], { other: '1' })).toBe(false); // strict equality, no coercion
  });

  it('different is the exact negation', () => {
    expect(different('a', ['other'], { other: 'b' })).toBe(true);
    expect(different('a', ['other'], { other: 'a' })).toBe(false);
  });

  it('throws when no comparison field is given', () => {
    expect(() => same('a', [], { other: 'a' })).toThrow(Error);
  });
});

describe('conditional-required predicates', () => {
  it('required_if: condition true when the named field equals the given value', () => {
    expect(isRequiredByCondition('required_if', ['status', 'rejected'], { status: 'rejected' })).toBe(true);
    expect(isRequiredByCondition('required_if', ['status', 'rejected'], { status: 'approved' })).toBe(false);
  });

  it('required_unless: condition true when the named field does NOT equal the given value', () => {
    expect(isRequiredByCondition('required_unless', ['status', 'approved'], { status: 'rejected' })).toBe(true);
    expect(isRequiredByCondition('required_unless', ['status', 'approved'], { status: 'approved' })).toBe(false);
  });

  it('required_with: condition true when any named sibling field is non-empty', () => {
    expect(isRequiredByCondition('required_with', ['other'], { other: 'x' })).toBe(true);
    expect(isRequiredByCondition('required_with', ['other'], { other: '' })).toBe(false);
  });

  it('required_without: condition true when any named sibling field is empty', () => {
    expect(isRequiredByCondition('required_without', ['other'], { other: '' })).toBe(true);
    expect(isRequiredByCondition('required_without', ['other'], { other: 'x' })).toBe(false);
  });

  it('throws for malformed conditional-required params', () => {
    expect(() => isRequiredByCondition('required_if', ['status'], {})).toThrow(Error);
    expect(() => isRequiredByCondition('required_with', [], {})).toThrow(Error);
  });
});
