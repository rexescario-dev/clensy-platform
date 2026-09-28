import { ExecutionContext } from '@nestjs/common';
import { AdminScope } from '../domain/admin-scope';
import { Role } from '../domain/role';
import { principalFromContext } from '../decorators/current-user.decorator';

const principal = {
  id: 'admin-1',
  tenantId: 'tenant-1',
  role: Role.SCHEDULER,
  scope: AdminScope.TENANT,
};

// #85 Slice decision 4: the same principal is read from GraphQL's context
// and from an HTTP request.
describe('principalFromContext', () => {
  it('reads req.user from the GraphQL context', () => {
    const args = [{}, {}, { req: { user: principal } }, {}];
    const context = {
      // `GqlExecutionContext.create()` also reads `getClass`/`getHandler`
      // off the context (it builds a full `ExecutionContextHost`), so the
      // mock stands those in even though this test only exercises
      // `getContext()`.
      getArgByIndex: (i: number) => args[i],
      getArgs: () => args,
      getClass: () => class {},
      getHandler: () => () => undefined,
      getType: () => 'graphql',
    } as unknown as ExecutionContext;
    expect(principalFromContext(context)).toBe(principal);
  });

  it('reads req.user from an HTTP request', () => {
    const req = { user: principal };
    const context = {
      getArgByIndex: (i: number) => [req, {}, () => undefined][i],
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    expect(principalFromContext(context)).toBe(principal);
  });

  it('rejects an unsupported execution type instead of treating it as HTTP', () => {
    const context = { getType: () => 'rpc' } as unknown as ExecutionContext;
    expect(() => principalFromContext(context)).toThrow(
      /unsupported execution context type "rpc"/,
    );
  });
});
