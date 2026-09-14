import { describe, expect, it } from 'vitest';
import { formatMessage } from './messages';

describe('formatMessage', () => {
  it('substitutes :attribute with the default humanized field name', () => {
    expect(formatMessage('required', 'fullName', [])).toBe('The full name field is required.');
  });

  it('substitutes :attribute with an explicit attributes override', () => {
    expect(
      formatMessage('required', 'fullName', [], { attributes: { fullName: 'legal name' } }),
    ).toBe('The legal name field is required.');
  });

  it('substitutes rule params by position (:param0, :param1, ...)', () => {
    expect(formatMessage('min', 'password', ['8'])).toBe('The password must be at least 8.');
    expect(formatMessage('between', 'age', ['18', '65'])).toBe('The age must be between 18 and 65.');
  });

  it('applies an explicit messages override for a rule’s default template', () => {
    expect(
      formatMessage('required', 'email', [], { messages: { required: 'Please provide :attribute.' } }),
    ).toBe('Please provide email.');
  });

  it('humanizes a camelCase field into lowercase space-separated words', () => {
    expect(formatMessage('email', 'primaryEmailAddress', [])).toBe(
      'The primary email address must be a valid email address.',
    );
  });
});
