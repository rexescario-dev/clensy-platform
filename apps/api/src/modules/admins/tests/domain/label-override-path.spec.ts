import {
  appendPathSegment,
  MAX_PATH_KEY_CODE_POINTS,
} from '../../domain/label-override-path';

const PRINTABLE_ASCII_LINE = /^[\x20-\x7E]*$/;
const EMOJI = '\u{1F9FE}'; // one code point, two UTF-16 code units

describe('appendPathSegment (spec §4.2 Path rendering, #129)', () => {
  it('caps a stored key at 64 code points', () => {
    expect(MAX_PATH_KEY_CODE_POINTS).toBe(64);
  });

  describe('bare segments (identifier paths unchanged)', () => {
    it.each([
      ['', 'en', 'en'],
      ['', 'fr', 'fr'],
      ['en', 'roles', 'en.roles'],
      ['en', 'staff', 'en.staff'],
      ['en.roles', 'FINANCE', 'en.roles.FINANCE'],
      ['en.roles', 'SUPER_ADMIN', 'en.roles.SUPER_ADMIN'],
      ['en.roles', '_x9', 'en.roles._x9'],
    ])('appends %j + %j as %j', (parent, key, expected) => {
      expect(appendPathSegment(parent, key)).toBe(expected);
    });

    it('keeps a 64-code-point identifier bare', () => {
      const key = 'a'.repeat(64);
      expect(appendPathSegment('en.roles', key)).toBe(`en.roles.${key}`);
    });
  });

  describe('bracketed segments', () => {
    it.each([
      ['the empty key', '', '', '[""]'],
      ['a key named $', '', '$', '["$"]'],
      ['a key containing .', 'en.roles', 'a.b', 'en.roles["a.b"]'],
      ['a key with a hyphen', '', 'fr-CA', '["fr-CA"]'],
      ['a key starting with a digit', 'en', '1st', 'en["1st"]'],
      ['a key containing a space', 'en.roles', 'A B', 'en.roles["A B"]'],
    ])('brackets %s', (_label, parent, key, expected) => {
      expect(appendPathSegment(parent, key)).toBe(expected);
    });

    it('keeps a key named $ distinct from the root $', () => {
      expect(appendPathSegment('', '$')).not.toBe('$');
    });

    it('keeps a dotted key distinct from nesting', () => {
      expect(appendPathSegment('', 'a.b')).not.toBe(
        appendPathSegment(appendPathSegment('', 'a'), 'b'),
      );
    });
  });

  describe('escaping (hostile keys)', () => {
    it.each([
      ['a line feed', 'A\nB', 'A\\u000AB'],
      ['a carriage return', 'A\rB', 'A\\u000DB'],
      ['a tab', 'A\tB', 'A\\u0009B'],
      ['DEL', 'A\u007FB', 'A\\u007FB'],
      ['a C1 control (NEL)', 'A\u0085B', 'A\\u0085B'],
      ['the line separator', 'A\u2028B', 'A\\u2028B'],
      ['the paragraph separator', 'A\u2029B', 'A\\u2029B'],
      ['a bidi override', 'A\u202EB', 'A\\u202EB'],
      ['a non-ASCII letter', 'caf\u00E9', 'caf\\u00E9'],
      ['a supplementary character', `A${EMOJI}B`, 'A\\uD83E\\uDDFEB'],
      ['a lone high surrogate', 'A\uD800B', 'A\\uD800B'],
      ['a lone low surrogate', 'A\uDC00B', 'A\\uDC00B'],
      ['an embedded quote', 'A"B', 'A\\"B'],
      ['an embedded backslash', 'A\\B', 'A\\\\B'],
      [
        'a forged log line',
        'X\n[Nest] 1 - LOG ok',
        'X\\u000A[Nest] 1 - LOG ok',
      ],
    ])('escapes %s', (_label, key, escaped) => {
      const path = appendPathSegment('en.roles', key);
      expect(path).toBe(`en.roles["${escaped}"]`);
      expect(path).toMatch(PRINTABLE_ASCII_LINE);
    });
  });

  describe('truncation', () => {
    it('brackets a 65-code-point identifier and marks one dropped', () => {
      expect(appendPathSegment('en.roles', 'a'.repeat(65))).toBe(
        `en.roles["${'a'.repeat(64)}"...(+1)]`,
      );
    });

    it('counts a supplementary character as one code point', () => {
      expect(appendPathSegment('', `${EMOJI.repeat(64)}`)).toBe(
        `["${'\\uD83E\\uDDFE'.repeat(64)}"]`,
      );
      expect(appendPathSegment('', `${EMOJI.repeat(65)}`)).toBe(
        `["${'\\uD83E\\uDDFE'.repeat(64)}"...(+1)]`,
      );
    });

    it('counts a lone surrogate as one code point', () => {
      expect(appendPathSegment('', `${'a'.repeat(64)}\uD800`)).toBe(
        `["${'a'.repeat(64)}"...(+1)]`,
      );
    });

    it('truncates before escaping, so escapes never count toward the cap', () => {
      expect(appendPathSegment('', '\n'.repeat(65))).toBe(
        `["${'\\u000A'.repeat(64)}"...(+1)]`,
      );
    });

    it('bounds a very long key and records only how much was dropped', () => {
      const path = appendPathSegment('en.roles', 'x'.repeat(10_000));
      expect(path).toBe(`en.roles["${'x'.repeat(64)}"...(+9936)]`);
      expect(path).not.toContain('x'.repeat(65));
    });

    it('renders the worst-case prefix in at most 768 characters', () => {
      const path = appendPathSegment('', EMOJI.repeat(100_000));
      const prefix = path.slice('["'.length, path.indexOf('"...'));
      expect(prefix).toHaveLength(768);
      expect(path).toMatch(PRINTABLE_ASCII_LINE);
    });
  });
});
