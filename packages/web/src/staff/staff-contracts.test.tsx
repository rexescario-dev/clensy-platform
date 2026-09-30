import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { STAFF_ROLE_GROUPS, STAFF_ROLE_OPTIONS, isStaffRole } from './staff-roles';
import { STAFF_ERROR_KEYS } from './staff-errors';
import { useClensyTranslations } from '../i18n/use-clensy-translations';
import { ClensyI18nProvider } from '../i18n/i18n-context';

function Resolve({ keys }: { keys: string[] }) {
  const t = useClensyTranslations('staff');
  return <ul>{keys.map((key) => <li key={key} data-key={key}>{t(key)}</li>)}</ul>;
}

// Rendered through an explicit provider (locale is optional and resolves to
// 'en'). @clensy/web also supports no provider at all — useClensyI18nContext
// falls back to the same defaults — but the test pins the provider path the
// page uses.
function resolvedTexts(keys: string[]): string[] {
  const html = renderToStaticMarkup(
    <ClensyI18nProvider>
      <Resolve keys={keys} />
    </ClensyI18nProvider>,
  );
  return [...html.matchAll(/<li data-key="[^"]*">([^<]*)<\/li>/g)].map((m) => m[1]);
}

describe('staff role contract', () => {
  it('offers exactly the six tenant roles, owner group first, never SUPER_ADMIN', () => {
    expect(STAFF_ROLE_GROUPS.map((g) => g.id)).toEqual(['owner', 'staff']);
    expect(STAFF_ROLE_GROUPS[0].roles).toEqual(['TENANT_OWNER']);
    expect([...STAFF_ROLE_OPTIONS].sort()).toEqual(
      ['ANALYST', 'CUSTOMER_SUPPORT', 'FINANCE', 'OPS_MANAGER', 'SCHEDULER', 'TENANT_OWNER'].sort(),
    );
    expect(STAFF_ROLE_OPTIONS).not.toContain('SUPER_ADMIN');
    expect(STAFF_ROLE_OPTIONS).not.toContain('OWNER');
  });

  it('recognises only tenant roles', () => {
    expect(isStaffRole('FINANCE')).toBe(true);
    expect(isStaffRole('SUPER_ADMIN')).toBe(false);
    expect(isStaffRole('OWNER')).toBe(false);
  });
});

describe('staff namespace completeness', () => {
  it('resolves every role, group and error key to real text', () => {
    const keys = [
      ...STAFF_ROLE_OPTIONS.map((role) => `roles.${role}`),
      ...STAFF_ROLE_GROUPS.map((group) => `roleGroups.${group.id}`),
      ...STAFF_ERROR_KEYS.map((key) => `errors.${key}`),
    ];
    const texts = resolvedTexts(keys);
    expect(texts).toHaveLength(keys.length);
    texts.forEach((text, i) => expect(text).not.toBe(keys[i]));
  });

  it('uses the agreed English labels', () => {
    expect(resolvedTexts(['roles.TENANT_OWNER', 'roles.OPS_MANAGER', 'errors.lastTenantOwner'])).toEqual([
      'Tenant Owner',
      'Ops Manager',
      "You can&#x27;t disable the last active Tenant Owner. Add another Tenant Owner first.",
    ]);
  });

  it('lets an application override staff copy through ClensyI18nProvider', () => {
    const html = renderToStaticMarkup(
      <ClensyI18nProvider overrides={{ staff: { roles: { FINANCE: 'Billing' } } }}>
        <Resolve keys={['roles.FINANCE']} />
      </ClensyI18nProvider>,
    );
    expect(html).toContain('Billing');
  });
});
