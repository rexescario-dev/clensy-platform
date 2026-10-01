import { describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaffDataTable, buildStaffColumns, type StaffMember } from './staff-data-table';
import { ClensyI18nProvider } from '../i18n/i18n-context';

const t = (key: string) => key;
const me: StaffMember = { id: 'me', email: 'me@a.test', isActive: true, role: 'TENANT_OWNER' };
const otherOwner: StaffMember = { id: 'o2', email: 'o2@a.test', isActive: true, role: 'TENANT_OWNER' };
const finance: StaffMember = { id: 'f1', email: 'f1@a.test', isActive: true, role: 'FINANCE' };
const disabled: StaffMember = { id: 'd1', email: 'd1@a.test', isActive: false, role: 'ANALYST' };

function actionsCell(member: StaffMember, onDisable = vi.fn()) {
  const column = buildStaffColumns(t, { currentAdminId: me.id, onDisable }).find((c) => c.key === 'actions');
  const render = column?.render;
  if (typeof render !== 'function') throw new Error('actions column must render a function');
  return render(member);
}

describe('StaffDataTable', () => {
  it('renders translated role labels, with Tenant Owner as a distinct badge', () => {
    const html = renderToStaticMarkup(
      <StaffDataTable staff={[otherOwner, finance]} currentAdminId={me.id} onDisable={() => {}} />,
    );
    expect(html).toContain('Tenant Owner');
    expect(html).toContain('Finance');
    expect(html).not.toContain('TENANT_OWNER');
    expect(html).not.toContain('roles.');
    expect(html).toMatch(/data-slot="badge"[^>]*>Tenant Owner</);
    expect(html).not.toMatch(/data-slot="badge"[^>]*>Finance</);
  });

  it('renders an unknown role identifier raw instead of a missing-key path', () => {
    const html = renderToStaticMarkup(
      <StaffDataTable
        staff={[{ id: 'x', email: 'x@a.test', isActive: true, role: 'SUPER_ADMIN' }]}
        currentAdminId={me.id}
        onDisable={() => {}}
      />,
    );
    expect(html).toContain('SUPER_ADMIN');
    expect(html).not.toContain('roles.SUPER_ADMIN');
  });

  it('renders Active/Disabled status labels', () => {
    const html = renderToStaticMarkup(
      <StaffDataTable staff={[finance, disabled]} currentAdminId={me.id} onDisable={() => {}} />,
    );
    expect(html).toContain('Active');
    expect(html).toContain('Disabled');
  });

  it('offers no Disable on the current admin row or on inactive rows', () => {
    expect(actionsCell(me)).toBeNull();
    expect(actionsCell(disabled)).toBeNull();
  });

  it('offers Disable on other active rows, including other Tenant Owners, and reports the row', () => {
    const onDisable = vi.fn();
    const cell = actionsCell(otherOwner, onDisable);
    expect(isValidElement(cell)).toBe(true);
    (cell as ReactElement<{ onClick: () => void }>).props.onClick();
    expect(onDisable).toHaveBeenCalledWith(otherOwner);
    expect(isValidElement(actionsCell(finance))).toBe(true);
  });

  it('shows the translated empty and load-error messages', () => {
    expect(renderToStaticMarkup(<StaffDataTable staff={[]} currentAdminId={me.id} onDisable={() => {}} />)).toContain(
      'No staff accounts.',
    );
    expect(
      renderToStaticMarkup(<StaffDataTable staff={[]} currentAdminId={me.id} hasError onDisable={() => {}} />),
    ).toContain('Unable to load staff accounts.');
  });

  it('reads role labels from the shared roles namespace', () => {
    const html = renderToStaticMarkup(
      <ClensyI18nProvider overrides={{ roles: { FINANCE: 'Billing', TENANT_OWNER: 'Org Owner' } }}>
        <StaffDataTable staff={[otherOwner, finance]} currentAdminId={me.id} onDisable={() => {}} />
      </ClensyI18nProvider>,
    );
    expect(html).toContain('Billing');
    expect(html).toMatch(/data-slot="badge"[^>]*>Org Owner</);
  });
});
