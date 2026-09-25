import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../../../platform/auth/decorators/roles.decorator';
import { AdminScope } from '../../../../platform/auth/domain/admin-scope';
import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { CustomersService } from '../../application/services/customers.service';
import { Customer } from '../../domain/customer';
import { CustomerResolver } from '../../presentation/graphql/customer.resolver';

type ResolverMethod = 'createCustomer' | 'customer' | 'updateCustomer';

const VIEW_ROLES = [
  Role.TENANT_OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
  Role.ANALYST,
];

const WRITE_ROLES = [
  Role.TENANT_OWNER,
  Role.OPS_MANAGER,
  Role.CUSTOMER_SUPPORT,
];

function methodRef(method: ResolverMethod): (...args: unknown[]) => unknown {
  const descriptor = Object.getOwnPropertyDescriptor(
    CustomerResolver.prototype,
    method,
  );
  return descriptor!.value as (...args: unknown[]) => unknown;
}

describe('CustomerResolver', () => {
  const reflector = new Reflector();

  function guardsOn(method: ResolverMethod): unknown[] {
    const guards = Reflect.getMetadata(GUARDS_METADATA, methodRef(method)) as
      unknown[] | undefined;
    return guards ?? [];
  }

  function rolesOn(method: ResolverMethod): Role[] | undefined {
    return reflector.get<Role[] | undefined>(ROLES_KEY, methodRef(method));
  }

  it('customer is guarded by AuthGuard and the view matrix', () => {
    expect(guardsOn('customer')).toContain(AuthGuard);
    expect(rolesOn('customer')).toEqual(VIEW_ROLES);
  });

  describe.each([
    ['createCustomer', WRITE_ROLES],
    ['updateCustomer', WRITE_ROLES],
  ] as const)('%s', (method, expectedRoles) => {
    it(`is guarded by AuthGuard and @Roles(${expectedRoles.join(', ')}) — write matrix`, () => {
      expect(guardsOn(method)).toContain(AuthGuard);
      expect(rolesOn(method)).toEqual(expectedRoles);
    });
  });
});

// Tenant isolation (#82, multi-tenant spec §4.5, controller ruling 2): the
// tenant comes only from the DB-loaded principal. Reads pass it through
// (`string | null`, the service fails closed); writes require it.
describe('CustomerResolver tenant scoping', () => {
  const principal: AuthenticatedPrincipal = {
    id: 'admin-1',
    tenantId: 't-a',
    role: Role.TENANT_OWNER,
    scope: AdminScope.TENANT,
  };
  const customer: Customer = {
    id: 'c-1',
    tenantId: 't-a',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    email: 'jane@example.com',
    fullName: 'Jane',
    notes: null,
    phone: '555',
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
  let service: {
    create: jest.Mock;
    getCustomer: jest.Mock;
    update: jest.Mock;
  };
  let resolver: CustomerResolver;

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue(customer),
      getCustomer: jest.fn().mockResolvedValue(customer),
      update: jest.fn().mockResolvedValue(customer),
    };
    resolver = new CustomerResolver(service as unknown as CustomersService);
  });

  it('customer(id) looks up within the principal tenant', async () => {
    await expect(resolver.customer('c-1', principal)).resolves.toMatchObject({
      id: 'c-1',
    });
    expect(service.getCustomer).toHaveBeenCalledWith('c-1', 't-a');
  });

  it('customer(id) passes a null tenant through (the service fails closed)', async () => {
    service.getCustomer.mockResolvedValue(null);
    await expect(
      resolver.customer('c-1', { ...principal, tenantId: null }),
    ).resolves.toBeNull();
    expect(service.getCustomer).toHaveBeenCalledWith('c-1', null);
  });

  it('createCustomer builds the command with the principal tenant, never the input', async () => {
    const input = {
      tenantId: 't-evil',
      email: 'jane@example.com',
      fullName: 'Jane',
      phone: '555',
    };
    await resolver.createCustomer(input, principal);
    expect(service.create).toHaveBeenCalledWith({
      actorId: 'admin-1',
      tenantId: 't-a',
      email: 'jane@example.com',
      fullName: 'Jane',
      phone: '555',
    });
  });

  it('updateCustomer builds the command with the principal tenant, never the input', async () => {
    await resolver.updateCustomer(
      'c-1',
      { fullName: 'Janet', tenantId: 't-evil' } as never,
      principal,
    );
    expect(service.update).toHaveBeenCalledWith('c-1', {
      actorId: 'admin-1',
      fullName: 'Janet',
      tenantId: 't-a',
    });
  });

  it.each(['createCustomer', 'updateCustomer'] as const)(
    '%s is forbidden without a principal tenant',
    async (method) => {
      const noTenant = { ...principal, tenantId: null };
      const call =
        method === 'createCustomer'
          ? resolver.createCustomer({} as never, noTenant)
          : resolver.updateCustomer('c-1', {}, noTenant);
      await expect(call).rejects.toBeInstanceOf(ForbiddenException);
      expect(service.create).not.toHaveBeenCalled();
      expect(service.update).not.toHaveBeenCalled();
    },
  );
});
