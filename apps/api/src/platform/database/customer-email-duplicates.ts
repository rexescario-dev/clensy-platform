// Pure validator for the duplicate-email check in `AddCustomerPropertyTenant`
// (#82 slice decision 1; RFC §4.4). Existing customers that share
// `lower(email)` within a tenant would make `uq_customer_tenant_email`
// impossible to create. The migration never merges, deletes, or picks a
// canonical customer — it aborts and names every conflict so an operator
// can remediate by hand and re-run.

// One group per (tenant, lowercased email) held by more than one customer.
export interface CustomerEmailDuplicateGroup {
  tenantId: string;
  email: string;
  customerIds: string[];
}

export class CustomerEmailDuplicateError extends Error {
  constructor(readonly groups: readonly CustomerEmailDuplicateGroup[]) {
    super(
      `Customers share an email within a tenant (case-insensitive); manual remediation is required before AddCustomerPropertyTenant can run. The migration was rolled back and no rows were changed:\n- ${groups
        .map(
          ({ tenantId, email, customerIds }) =>
            `tenant ${tenantId}, email ${email}: customers ${customerIds.join(', ')}`,
        )
        .join('\n- ')}`,
    );
    this.name = 'CustomerEmailDuplicateError';
  }
}

export function assertNoDuplicateCustomerEmails(
  groups: readonly CustomerEmailDuplicateGroup[],
): void {
  if (groups.length > 0) {
    throw new CustomerEmailDuplicateError(groups);
  }
}
