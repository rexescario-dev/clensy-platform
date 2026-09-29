// `getAuthorizer` is not re-exported from the package root, so this deep
// import is required (TEST-ONLY; tied to @ptc-org/nestjs-query-graphql 9.5.0).
import { getAuthorizer } from '@ptc-org/nestjs-query-graphql/src/decorators';
import { AdminScope } from '../../../../platform/auth/domain/admin-scope';
import { Role } from '../../../../platform/auth/domain/role';
import { InvoiceType } from '../../../billing/presentation/graphql/invoice.type';
import { LaundryOrderType } from '../../presentation/graphql/laundry-order.type';

// #87 slice decision 5. Security invariant: every nestjs-query read of
// `LaundryOrderType` / `InvoiceType` — the root list and count, and every
// relation that targets one — is ANDed with the principal's tenant. This is
// a metadata regression guard; the proof is the two-tenant e2e (Task 6).
describe.each([
  ['LaundryOrderType', LaundryOrderType],
  ['InvoiceType', InvoiceType],
])('%s tenant authorizer', (_name, DTO) => {
  async function filterFor(context: object) {
    const Authorizer = getAuthorizer(DTO as never);
    expect(Authorizer).toBeDefined();
    const authorizer = new Authorizer!({}, undefined);
    return authorizer.authorize(context, { operationGroup: 'read' } as never);
  }

  it('constrains reads to the principal tenant', async () => {
    await expect(
      filterFor({
        req: {
          user: {
            id: 'u',
            tenantId: 't-a',
            role: Role.OPS_MANAGER,
            scope: AdminScope.TENANT,
          },
        },
      }),
    ).resolves.toEqual({ tenantId: { eq: 't-a' } });
  });

  it('matches no row without a principal', async () => {
    await expect(filterFor({})).resolves.toEqual({ id: { is: null } });
  });
});
