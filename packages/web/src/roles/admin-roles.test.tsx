import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ADMIN_ROLES, ROLE_INITIALS, isAdminRole } from './admin-roles';
import { STAFF_ROLE_OPTIONS } from '../staff/staff-roles';
import { ClensyI18nProvider } from '../i18n/i18n-context';
import { getDefaultMessages } from '../i18n/messages';
import { useClensyTranslations } from '../i18n/use-clensy-translations';
import * as publicApi from '../index';

function Resolve({ keys }: { keys: string[] }) {
  const t = useClensyTranslations('roles');
  return <ul>{keys.map((key) => <li key={key} data-key={key}>{t(key)}</li>)}</ul>;
}

function resolvedTexts(keys: string[], overrides?: Parameters<typeof ClensyI18nProvider>[0]['overrides']): string[] {
  const html = renderToStaticMarkup(
    <ClensyI18nProvider overrides={overrides}>
      <Resolve keys={keys} />
    </ClensyI18nProvider>,
  );
  return [...html.matchAll(/<li data-key="[^"]*">([^<]*)<\/li>/g)].map((m) => m[1]);
}

describe('admin role contract', () => {
  // #88 precondition: ADMIN_ROLES is built from STAFF_ROLE_OPTIONS, so pin
  // that list itself rather than letting ADMIN_ROLES mask a stale entry.
  it('builds on exactly the six tenant roles from #88', () => {
    expect([...STAFF_ROLE_OPTIONS].sort()).toEqual(
      ['ANALYST', 'CUSTOMER_SUPPORT', 'FINANCE', 'OPS_MANAGER', 'SCHEDULER', 'TENANT_OWNER'].sort(),
    );
  });

  it('lists exactly the seven AdminUser roles, never the retired OWNER', () => {
    expect([...ADMIN_ROLES].sort()).toEqual(
      ['ANALYST', 'CUSTOMER_SUPPORT', 'FINANCE', 'OPS_MANAGER', 'SCHEDULER', 'SUPER_ADMIN', 'TENANT_OWNER'].sort(),
    );
    expect(ADMIN_ROLES).not.toContain('OWNER');
  });

  it('recognises every AdminUser role and nothing else', () => {
    expect(isAdminRole('SUPER_ADMIN')).toBe(true);
    expect(isAdminRole('FINANCE')).toBe(true);
    expect(isAdminRole('OWNER')).toBe(false);
    expect(isAdminRole('')).toBe(false);
  });

  it('keeps fixed two-letter initials per role, independent of labels', () => {
    expect(ROLE_INITIALS).toEqual({
      ANALYST: 'AN',
      CUSTOMER_SUPPORT: 'CS',
      FINANCE: 'FI',
      OPS_MANAGER: 'OM',
      SCHEDULER: 'SC',
      SUPER_ADMIN: 'SA',
      TENANT_OWNER: 'TO',
    });
    expect(resolvedTexts(['FINANCE'], { roles: { FINANCE: 'Billing' } })).toEqual(['Billing']);
    expect(ROLE_INITIALS.FINANCE).toBe('FI');
  });

  it('exports the role contract from the package entry', () => {
    expect(publicApi.ADMIN_ROLES).toBe(ADMIN_ROLES);
    expect(publicApi.ROLE_INITIALS).toBe(ROLE_INITIALS);
    expect(publicApi.isAdminRole).toBe(isAdminRole);
  });
});

describe('roles namespace', () => {
  it('resolves every AdminUser role to the agreed English label', () => {
    expect(resolvedTexts([...ADMIN_ROLES])).toEqual(
      ADMIN_ROLES.map((role) => ({
        ANALYST: 'Analyst',
        CUSTOMER_SUPPORT: 'Customer Support',
        FINANCE: 'Finance',
        OPS_MANAGER: 'Ops Manager',
        SCHEDULER: 'Scheduler',
        SUPER_ADMIN: 'Super Admin',
        TENANT_OWNER: 'Tenant Owner',
      })[role]),
    );
  });

  it('is the only home of role labels — the staff namespace no longer carries them', () => {
    expect('roles' in getDefaultMessages().staff).toBe(false);
  });
});
