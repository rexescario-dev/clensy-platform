import {
  tenantFilterFor,
  tenantReadAuthorizer,
} from '../authorization/tenant-read.authorizer';
import { AdminScope } from '../domain/admin-scope';
import { Role } from '../domain/role';

const context = (user: unknown) => ({ req: { user } });
const authCtx = {
  many: true,
  operationGroup: 'read',
  operationName: 'query',
  readonly: true,
} as never;

describe('tenantReadAuthorizer', () => {
  it('constrains reads to the principal tenant', async () => {
    const filter = await tenantReadAuthorizer().authorize(
      context({
        id: 'u',
        tenantId: 't-a',
        role: Role.SCHEDULER,
        scope: AdminScope.TENANT,
      }),
      authCtx,
    );
    expect(filter).toEqual({ tenantId: { eq: 't-a' } });
  });

  it('fails closed (matches no row) when the principal has no tenant', async () => {
    const filter = await tenantReadAuthorizer().authorize(
      context({
        id: 'u',
        tenantId: null,
        role: Role.SUPER_ADMIN,
        scope: AdminScope.PLATFORM,
      }),
      authCtx,
    );
    expect(filter).toEqual({ id: { is: null } });
  });

  it('fails closed when no principal is on the request', async () => {
    expect(
      await tenantReadAuthorizer().authorize(context(undefined), authCtx),
    ).toEqual({ id: { is: null } });
  });

  it('tenantFilterFor mirrors the same rule', () => {
    expect(tenantFilterFor('t-a')).toEqual({ tenantId: { eq: 't-a' } });
    expect(tenantFilterFor(null)).toEqual({ id: { is: null } });
  });
});
