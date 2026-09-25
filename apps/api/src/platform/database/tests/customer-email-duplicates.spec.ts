import {
  assertNoDuplicateCustomerEmails,
  CustomerEmailDuplicateError,
} from '../customer-email-duplicates';

// Slice decision 1 (#82): existing customers that would violate the
// tenant-scoped, case-insensitive email uniqueness abort
// `AddCustomerPropertyTenant`, listing every conflict for manual remediation.
describe('assertNoDuplicateCustomerEmails', () => {
  it('passes with no groups', () => {
    expect(() => assertNoDuplicateCustomerEmails([])).not.toThrow();
  });

  it('throws listing every duplicate email and customer id', () => {
    const run = () =>
      assertNoDuplicateCustomerEmails([
        { tenantId: 't', email: 'jane@example.com', customerIds: ['c1', 'c2'] },
        {
          tenantId: 't',
          email: 'bob@example.com',
          customerIds: ['c3', 'c4', 'c5'],
        },
      ]);
    expect(run).toThrow(CustomerEmailDuplicateError);
    expect(run).toThrow(/jane@example\.com.*c1.*c2/s);
    expect(run).toThrow(/bob@example\.com.*c3.*c4.*c5/s);
  });

  it('names the tenant and states that no rows were changed', () => {
    const run = () =>
      assertNoDuplicateCustomerEmails([
        {
          tenantId: 'tenant-9',
          email: 'a@example.com',
          customerIds: ['x', 'y'],
        },
      ]);
    expect(run).toThrow(/tenant-9/);
    expect(run).toThrow(/manual remediation/i);
    expect(run).toThrow(/no rows were changed/i);
  });

  it('exposes the groups on the error', () => {
    const groups = [
      { tenantId: 't', email: 'a@example.com', customerIds: ['x', 'y'] },
    ];
    let error: unknown;
    try {
      assertNoDuplicateCustomerEmails(groups);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(CustomerEmailDuplicateError);
    expect((error as CustomerEmailDuplicateError).groups).toEqual(groups);
  });
});
