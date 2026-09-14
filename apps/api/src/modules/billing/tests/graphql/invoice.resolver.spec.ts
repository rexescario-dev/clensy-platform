import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../../../platform/auth/decorators/roles.decorator';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { InvoicesService } from '../../application/services/invoices.service';
import { InvoicePaymentStatus } from '../../domain/invoice-payment-status';
import { InvoicePaymentTerms } from '../../domain/invoice-payment-terms';
import { InvoiceResolver } from '../../presentation/graphql/invoice.resolver';

const O = Role.OWNER;
const M = Role.OPS_MANAGER;
const S = Role.SCHEDULER;
const C = Role.CUSTOMER_SUPPORT;
const F = Role.FINANCE;
const A = Role.ANALYST;

const RBAC: Record<string, Role[]> = {
  generateInvoiceFromOrder: [F, O],
  invoice: [O, M, S, C, F, A],
};

function methodRef(name: string): (...args: unknown[]) => unknown {
  return Object.getOwnPropertyDescriptor(InvoiceResolver.prototype, name)!
    .value as (...args: unknown[]) => unknown;
}

describe('InvoiceResolver', () => {
  const reflector = new Reflector();

  describe.each(Object.entries(RBAC))('%s', (method, expectedRoles) => {
    it(`is guarded by AuthGuard and @Roles(${expectedRoles.join(', ')})`, () => {
      const guards = (Reflect.getMetadata(GUARDS_METADATA, methodRef(method)) ??
        []) as unknown[];
      expect(guards).toContain(AuthGuard);
      expect(reflector.get<Role[]>(ROLES_KEY, methodRef(method))).toEqual(
        expectedRoles,
      );
    });
  });

  describe('behavior', () => {
    let service: jest.Mocked<
      Pick<InvoicesService, 'generateFromOrder' | 'getInvoice'>
    >;
    let resolver: InvoiceResolver;
    const user = { id: 'actor-9' } as never;
    const invoice = {
      id: 'inv-1',
      customerId: 'cust-1',
      laundryOrderId: 'order-1',
      amountPaidMinorUnits: 0,
      createdAt: new Date(),
      discountMinorUnits: 0,
      dueDate: new Date(),
      invoiceNumber: 'INV-2026-000042',
      issueDate: new Date(),
      paymentStatus: InvoicePaymentStatus.UNPAID,
      paymentTerms: InvoicePaymentTerms.PAY_NOW,
      subtotalMinorUnits: 3725,
      totalMinorUnits: 3725,
      updatedAt: new Date(),
    };

    beforeEach(() => {
      service = {
        generateFromOrder: jest.fn().mockResolvedValue(invoice),
        getInvoice: jest.fn(),
      };
      resolver = new InvoiceResolver(service as never);
    });

    it('invoice returns null for a missing id', async () => {
      service.getInvoice.mockResolvedValue(null);
      await expect(resolver.invoice('nope')).resolves.toBeNull();
    });

    it('generateInvoiceFromOrder threads the actor id into the command', async () => {
      await resolver.generateInvoiceFromOrder(
        {
          laundryOrderId: 'order-1',
          paymentTerms: InvoicePaymentTerms.PAY_ON_COMPLETION,
        },
        user,
      );
      expect(service.generateFromOrder).toHaveBeenCalledWith({
        actorId: 'actor-9',
        laundryOrderId: 'order-1',
        paymentTerms: InvoicePaymentTerms.PAY_ON_COMPLETION,
      });
    });

    it('amountDueMinorUnits is total minus amount paid', () => {
      expect(
        resolver.amountDueMinorUnits({
          amountPaidMinorUnits: 1000,
          totalMinorUnits: 3725,
        }),
      ).toBe(2725);
    });
  });
});
