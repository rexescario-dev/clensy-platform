import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CreateStaffForm, type CreateStaffFormValues } from './create-staff-form';
import * as publicApi from '../index';

const base: CreateStaffFormValues = { email: '', password: '', role: 'CUSTOMER_SUPPORT' };
const render = (props: Partial<Parameters<typeof CreateStaffForm>[0]> = {}) =>
  renderToStaticMarkup(<CreateStaffForm values={base} onChange={() => {}} {...props} />);

describe('CreateStaffForm', () => {
  it('groups roles under Tenant Owner and Staff with translated labels', () => {
    const html = render();
    expect(html).toMatch(/<optgroup label="Tenant Owner"><option value="TENANT_OWNER">Tenant Owner<\/option><\/optgroup>/);
    expect(html).toMatch(/<optgroup label="Staff">.*<option value="OPS_MANAGER">Ops Manager<\/option>.*<\/optgroup>/);
    const values = [...html.matchAll(/<option value="([A-Z_]+)"/g)].map((m) => m[1]);
    expect(values.sort()).toEqual(
      ['ANALYST', 'CUSTOMER_SUPPORT', 'FINANCE', 'OPS_MANAGER', 'SCHEDULER', 'TENANT_OWNER'].sort(),
    );
    expect(html).not.toContain('SUPER_ADMIN');
  });

  it('shows the Tenant Owner hint only when Tenant Owner is selected', () => {
    const hint = 'Can manage staff accounts for this organization.';
    expect(render()).not.toContain(hint);
    expect(render({ values: { ...base, role: 'TENANT_OWNER' } })).toContain(hint);
  });

  it('renders the translated error for an error key as an alert', () => {
    const html = render({ errorKey: 'emailInUse' });

    expect(html).toContain('An account with this email already exists.');
    expect(html).toContain('role="alert"');
  });

  it('renders no alert when there is no error key', () => {
    expect(render()).not.toContain('role="alert"');
  });

  it('is exported from the package with the role contract', () => {
    expect(publicApi.CreateStaffForm).toBe(CreateStaffForm);
    expect(publicApi.StaffDataTable).toBeTypeOf('function');
    expect(publicApi.STAFF_ROLE_OPTIONS).toContain('TENANT_OWNER');
    expect(publicApi.STAFF_ERROR_KEYS).toContain('lastTenantOwner');
  });
});
