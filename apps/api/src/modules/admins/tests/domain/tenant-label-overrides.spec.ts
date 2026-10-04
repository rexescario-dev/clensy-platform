import { Role } from '../../../../platform/auth/domain/role';
import {
  MAX_LABEL_CODE_POINTS,
  RELABELABLE_ROLES,
  validateTenantLabelOverrides,
} from '../../domain/tenant-label-overrides';

const roles = (value: unknown) => ({ en: { roles: value } });

describe('validateTenantLabelOverrides (spec §4.2)', () => {
  describe('relabelable roles (drift)', () => {
    it('equals Role minus SUPER_ADMIN', () => {
      expect([...RELABELABLE_ROLES].sort()).toEqual(
        Object.values(Role)
          .filter((role) => role !== Role.SUPER_ADMIN)
          .sort(),
      );
      expect(MAX_LABEL_CODE_POINTS).toBe(64);
    });
  });

  describe('kept leaves', () => {
    it('keeps a valid leaf and returns it trimmed', () => {
      expect(
        validateTenantLabelOverrides(roles({ FINANCE: '  Billing  ' })),
      ).toEqual({ labels: { FINANCE: 'Billing' }, rejections: [] });
    });

    it('trims surrounding newlines before checking control characters', () => {
      expect(
        validateTenantLabelOverrides(roles({ FINANCE: '\nBilling\r\n' })),
      ).toEqual({ labels: { FINANCE: 'Billing' }, rejections: [] });
    });

    it('accepts exactly 64 code points and counts a non-BMP character as one', () => {
      const emoji = '\u{1F9FE}'; // two UTF-16 code units, one code point
      expect(emoji.length).toBe(2);
      const label = emoji.repeat(64);
      expect(validateTenantLabelOverrides(roles({ FINANCE: label }))).toEqual({
        labels: { FINANCE: label },
        rejections: [],
      });
      expect(
        validateTenantLabelOverrides(roles({ FINANCE: 'a'.repeat(64) })).labels,
      ).toEqual({ FINANCE: 'a'.repeat(64) });
    });
  });

  describe('rejected leaves', () => {
    it.each([
      ['65 code points', 'a'.repeat(65), 'too-long'],
      ['65 non-BMP code points', '\u{1F9FE}'.repeat(65), 'too-long'],
      ['an empty string', '', 'blank'],
      ['whitespace only', ' \t \n ', 'blank'],
      ['an interior newline', 'Bill\ning', 'control-character'],
      ['an interior carriage return', 'Bill\ring', 'control-character'],
      ['another control character', 'Bill\u0007ing', 'control-character'],
      [
        'a leading NUL (not whitespace, so not trimmed)',
        '\u0000Billing',
        'control-character',
      ],
      ['a number', 42, 'not-a-string'],
      ['a boolean', true, 'not-a-string'],
      ['null', null, 'not-a-string'],
      ['an object', { text: 'Billing' }, 'not-a-string'],
    ])('drops %s', (_label, value, reason) => {
      expect(validateTenantLabelOverrides(roles({ FINANCE: value }))).toEqual({
        labels: null,
        rejections: [{ path: 'en.roles.FINANCE', reason }],
      });
    });

    it('drops SUPER_ADMIN and unknown role keys as unknown-key', () => {
      expect(
        validateTenantLabelOverrides(
          roles({ NOT_A_ROLE: 'x', SUPER_ADMIN: 'Root' }),
        ),
      ).toEqual({
        labels: null,
        rejections: [
          { path: 'en.roles.NOT_A_ROLE', reason: 'unknown-key' },
          { path: 'en.roles.SUPER_ADMIN', reason: 'unknown-key' },
        ],
      });
    });
  });

  describe('structure', () => {
    it.each([
      ['null', null],
      ['an array', ['Billing']],
      ['a string', 'Billing'],
      ['a number', 7],
      ['a boolean', false],
    ])(
      'rejects %s at each level as not-an-object, once, without descending',
      (_label, value) => {
        if (value !== null) {
          expect(validateTenantLabelOverrides(value)).toEqual({
            labels: null,
            rejections: [{ path: '$', reason: 'not-an-object' }],
          });
        }
        expect(validateTenantLabelOverrides({ en: value })).toEqual({
          labels: null,
          rejections: [{ path: 'en', reason: 'not-an-object' }],
        });
        expect(validateTenantLabelOverrides(roles(value))).toEqual({
          labels: null,
          rejections: [{ path: 'en.roles', reason: 'not-an-object' }],
        });
      },
    );

    it('reports one rejection for a roles array of many items', () => {
      const result = validateTenantLabelOverrides(
        roles(Array.from({ length: 100 }, () => 'Billing')),
      );
      expect(result.rejections).toEqual([
        { path: 'en.roles', reason: 'not-an-object' },
      ]);
    });

    it('drops unknown locales and unknown namespaces at their own path', () => {
      expect(
        validateTenantLabelOverrides({
          en: { roles: { FINANCE: 'Billing' }, staff: { title: 'Team' } },
          fr: { roles: { FINANCE: 'Facturation' } },
        }),
      ).toEqual({
        labels: { FINANCE: 'Billing' },
        rejections: [
          { path: 'fr', reason: 'unknown-key' },
          { path: 'en.staff', reason: 'unknown-key' },
        ],
      });
    });

    it('returns none without rejections for a NULL column and for empty shapes', () => {
      for (const raw of [null, {}, { en: {} }, roles({})]) {
        expect(validateTenantLabelOverrides(raw)).toEqual({
          labels: null,
          rejections: [],
        });
      }
    });

    it('returns none when every leaf is invalid', () => {
      const result = validateTenantLabelOverrides(
        roles({ ANALYST: '', FINANCE: 42 }),
      );
      expect(result.labels).toBeNull();
      expect(result.rejections).toHaveLength(2);
    });
  });

  it('never puts a stored value into a rejection', () => {
    const { rejections } = validateTenantLabelOverrides({
      en: {
        roles: { ANALYST: 'Secret\nLabel', SUPER_ADMIN: 'Root-Label' },
        staff: 'Team-Label',
      },
      fr: 'Facturation',
    });
    const serialized = JSON.stringify(rejections);
    for (const value of ['Secret', 'Root-Label', 'Team-Label', 'Facturation']) {
      expect(serialized).not.toContain(value);
    }
  });
});
