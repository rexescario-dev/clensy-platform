import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
} from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLObjectType,
  GraphQLSchema,
} from 'graphql';
import { ROLES_KEY } from '../../../../platform/auth/decorators/roles.decorator';
import { AdminScope } from '../../../../platform/auth/domain/admin-scope';
import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { InvoicePaymentStatus } from '../../../billing/domain/invoice-payment-status';
import { InvoicePaymentTerms } from '../../../billing/domain/invoice-payment-terms';
import { InvoiceResolver } from '../../../billing/presentation/graphql/invoice.resolver';
import { Payment } from '../../domain/payment';
import { PaymentMethod } from '../../domain/payment-method';
import { PaymentRecordStatus } from '../../domain/payment-record-status';
import { PaymentType } from '../../domain/payment-type';
import { PaymentResolver } from '../../presentation/graphql/payment.resolver';
// Side effect only: `PaymentResolver` -> `InvoiceType` pulls `InvoiceLineType`
// into the type metadata, whose `PricingUnit` enum the catalog registers
// here (in the app, `CatalogModule` loads it).
import '../../../catalog/presentation/graphql/create-pricing-rule.input';

const O = Role.TENANT_OWNER;
const M = Role.OPS_MANAGER;
const C = Role.CUSTOMER_SUPPORT;
const F = Role.FINANCE;

// Spec §4.7, exactly.
const RBAC: Record<string, Role[]> = {
  recordInvoicePayment: [O, M, F, C],
  refundInvoicePayment: [O, F],
};

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'pay-1',
    invoiceId: 'inv-1',
    recordedByStaffId: 'actor-1',
    refundedPaymentId: null,
    tenantId: 't-a',
    amountMinorUnits: 1000,
    createdAt: new Date('2026-11-01T00:00:01Z'),
    idempotencyKey: '7b0e7a40-2c39-4f5b-9a51-1f0b2c3d4e5f',
    method: PaymentMethod.CASH,
    paidAt: new Date('2026-11-01T00:00:00Z'),
    reference: null,
    status: PaymentRecordStatus.COMPLETED,
    type: PaymentType.PAYMENT,
    ...overrides,
  };
}

function methodRef(name: string): (...args: unknown[]) => unknown {
  return Object.getOwnPropertyDescriptor(PaymentResolver.prototype, name)!
    .value as (...args: unknown[]) => unknown;
}

const principal: AuthenticatedPrincipal = {
  id: 'actor-1',
  tenantId: 't-a',
  role: Role.FINANCE,
  scope: AdminScope.TENANT,
};
const noTenant: AuthenticatedPrincipal = { ...principal, tenantId: null };

describe('PaymentResolver', () => {
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

  // Decision r: a class-level guard would apply to the relation fields.
  it('declares no guards or @Roles() on the class', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, PaymentResolver)).toBe(
      undefined,
    );
    expect(reflector.get(ROLES_KEY, PaymentResolver)).toBeUndefined();
  });

  it.each(['invoice', 'refundableMinorUnits'])(
    'declares no guards or @Roles() on the %s resolve-field',
    (method) => {
      expect(Reflect.getMetadata(GUARDS_METADATA, methodRef(method))).toBe(
        undefined,
      );
      expect(reflector.get(ROLES_KEY, methodRef(method))).toBeUndefined();
    },
  );

  describe('behavior', () => {
    let payments: { record: jest.Mock; refund: jest.Mock };
    let invoices: { getInvoice: jest.Mock };
    let load: jest.Mock;
    let loaderFor: jest.Mock;
    let resolver: PaymentResolver;

    beforeEach(() => {
      payments = {
        record: jest.fn().mockResolvedValue(makePayment()),
        refund: jest.fn().mockResolvedValue(
          makePayment({
            id: 'pay-2',
            refundedPaymentId: 'pay-1',
            type: PaymentType.REFUND,
          }),
        ),
      };
      invoices = { getInvoice: jest.fn() };
      load = jest.fn().mockResolvedValue(700);
      loaderFor = jest.fn().mockReturnValue({ load });
      resolver = new PaymentResolver(
        payments as never,
        invoices as never,
        { loaderFor } as never,
      );
    });

    it('recordInvoicePayment passes actorId / tenantId from the principal', async () => {
      const paidAt = new Date('2026-11-01T00:00:00Z');
      const result = await resolver.recordInvoicePayment(
        {
          invoiceId: 'inv-1',
          amountMinorUnits: 1000,
          idempotencyKey: 'k-1',
          method: PaymentMethod.GCASH,
          paidAt,
          reference: 'ref',
        },
        principal,
      );
      expect(payments.record).toHaveBeenCalledWith({
        actorId: 'actor-1',
        invoiceId: 'inv-1',
        tenantId: 't-a',
        amountMinorUnits: 1000,
        idempotencyKey: 'k-1',
        method: PaymentMethod.GCASH,
        paidAt,
        reference: 'ref',
      });
      expect(result).not.toHaveProperty('tenantId');
      expect(result).not.toHaveProperty('idempotencyKey');
      expect(result.id).toBe('pay-1');
    });

    it('refundInvoicePayment passes actorId / tenantId from the principal', async () => {
      await resolver.refundInvoicePayment(
        {
          paymentId: 'pay-1',
          amountMinorUnits: 100,
          idempotencyKey: 'k-2',
          method: PaymentMethod.CASH,
        },
        principal,
      );
      expect(payments.refund).toHaveBeenCalledWith({
        actorId: 'actor-1',
        paymentId: 'pay-1',
        tenantId: 't-a',
        amountMinorUnits: 100,
        idempotencyKey: 'k-2',
        method: PaymentMethod.CASH,
      });
    });

    it('both mutations are Forbidden for a tenant-less principal before the service is called', async () => {
      await expect(
        resolver.recordInvoicePayment(
          {
            invoiceId: 'i',
            amountMinorUnits: 1,
            idempotencyKey: 'k',
            method: PaymentMethod.CASH,
          },
          noTenant,
        ),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        resolver.refundInvoicePayment(
          {
            paymentId: 'p',
            amountMinorUnits: 1,
            idempotencyKey: 'k',
            method: PaymentMethod.CASH,
          },
          noTenant,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(payments.record).not.toHaveBeenCalled();
      expect(payments.refund).not.toHaveBeenCalled();
    });

    it('invoice reads the parent invoice in the principal tenant', async () => {
      invoices.getInvoice.mockResolvedValue({
        id: 'inv-1',
        customerId: 'c-1',
        laundryOrderId: 'o-1',
        tenantId: 't-a',
        amountPaidMinorUnits: 1000,
        createdAt: new Date(),
        discountMinorUnits: 0,
        dueDate: null,
        invoiceNumber: 'INV-1',
        issueDate: new Date(),
        paymentStatus: InvoicePaymentStatus.PARTIALLY_PAID,
        paymentTerms: InvoicePaymentTerms.PAY_NOW,
        subtotalMinorUnits: 2000,
        totalMinorUnits: 2000,
        updatedAt: new Date(),
      });
      const invoice = await resolver.invoice({ invoiceId: 'inv-1' }, principal);
      expect(invoices.getInvoice).toHaveBeenCalledWith('inv-1', 't-a');
      expect(invoice).toMatchObject({
        amountPaidMinorUnits: 1000,
        id: 'inv-1',
        paymentStatus: InvoicePaymentStatus.PARTIALLY_PAID,
      });
      expect(invoice).not.toHaveProperty('tenantId');
    });

    it('invoice throws NotFound when the invoice is not visible', async () => {
      invoices.getInvoice.mockResolvedValue(null);
      await expect(
        resolver.invoice({ invoiceId: 'inv-x' }, noTenant),
      ).rejects.toThrow(NotFoundException);
      expect(invoices.getInvoice).toHaveBeenCalledWith('inv-x', null);
    });

    it('refundableMinorUnits loads a COMPLETED PAYMENT through the principal-tenant loader', async () => {
      await expect(
        resolver.refundableMinorUnits(makePayment(), principal),
      ).resolves.toBe(700);
      expect(loaderFor).toHaveBeenCalledWith('t-a');
      expect(load).toHaveBeenCalledWith('pay-1');
    });

    it('refundableMinorUnits is null for a REFUND without calling the loader', async () => {
      await expect(
        resolver.refundableMinorUnits(
          makePayment({ type: PaymentType.REFUND }),
          principal,
        ),
      ).resolves.toBeNull();
      expect(loaderFor).not.toHaveBeenCalled();
      expect(load).not.toHaveBeenCalled();
    });

    it.each([PaymentRecordStatus.PENDING, PaymentRecordStatus.FAILED])(
      'refundableMinorUnits is null for a %s payment without calling the loader',
      async (status) => {
        await expect(
          resolver.refundableMinorUnits(makePayment({ status }), principal),
        ).resolves.toBeNull();
        expect(loaderFor).not.toHaveBeenCalled();
      },
    );
  });

  describe('schema', () => {
    let schema: GraphQLSchema;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [GraphQLSchemaBuilderModule],
      }).compile();
      // `InvoiceResolver` only supplies a Query root, which a schema requires.
      schema = await moduleRef
        .get(GraphQLSchemaFactory)
        .create([PaymentResolver, InvoiceResolver]);
    });

    // Spec §4.7: no tenantId, no idempotencyKey.
    it('Payment exposes exactly the spec §4.7 fields', () => {
      const payment = schema.getType('Payment') as GraphQLObjectType;
      const fields = payment.getFields();
      expect(Object.keys(fields).sort()).toEqual(
        [
          'amountMinorUnits',
          'createdAt',
          'id',
          'invoice',
          'invoiceId',
          'method',
          'paidAt',
          'recordedByStaffId',
          'reference',
          'refundableMinorUnits',
          'refundedPaymentId',
          'status',
          'type',
        ].sort(),
      );
      expect(
        Object.fromEntries(
          Object.entries(fields).map(([name, f]) => [name, String(f.type)]),
        ),
      ).toEqual({
        id: 'ID!',
        invoiceId: 'ID!',
        recordedByStaffId: 'ID',
        refundedPaymentId: 'ID',
        amountMinorUnits: 'Int!',
        createdAt: 'DateTime!',
        invoice: 'Invoice!',
        method: 'PaymentMethod!',
        paidAt: 'DateTime!',
        reference: 'String',
        refundableMinorUnits: 'Int',
        status: 'PaymentRecordStatus!',
        type: 'PaymentType!',
      });
    });

    it('registers the three payment enums under their spec names', () => {
      expect(
        (schema.getType('PaymentType') as GraphQLEnumType)
          .getValues()
          .map((v) => v.name),
      ).toEqual(['PAYMENT', 'REFUND']);
      expect(
        (schema.getType('PaymentMethod') as GraphQLEnumType)
          .getValues()
          .map((v) => v.name),
      ).toEqual(['CASH', 'GCASH', 'MAYA', 'BANK_TRANSFER', 'CARD', 'OTHER']);
      expect(
        (schema.getType('PaymentRecordStatus') as GraphQLEnumType)
          .getValues()
          .map((v) => v.name),
      ).toEqual(['COMPLETED', 'PENDING', 'FAILED']);
    });

    it.each([
      ['RecordInvoicePaymentInput', 'invoiceId'],
      ['RefundInvoicePaymentInput', 'paymentId'],
    ])('%s has exactly the spec §4.7 shape', (inputName, target) => {
      const input = schema.getType(inputName) as GraphQLInputObjectType;
      expect(
        Object.fromEntries(
          Object.entries(input.getFields()).map(([name, f]) => [
            name,
            String(f.type),
          ]),
        ),
      ).toEqual({
        [target]: 'ID!',
        amountMinorUnits: 'Int!',
        idempotencyKey: 'ID!',
        method: 'PaymentMethod!',
        paidAt: 'DateTime',
        reference: 'String',
      });
    });

    it('both mutations return Payment!', () => {
      const mutations = schema.getMutationType()!.getFields();
      expect(String(mutations.recordInvoicePayment.type)).toBe('Payment!');
      expect(String(mutations.refundInvoicePayment.type)).toBe('Payment!');
    });
  });
});
