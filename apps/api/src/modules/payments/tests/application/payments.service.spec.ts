import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, QueryFailedError } from 'typeorm';
import { AUDIT_LOGGER } from '../../../../platform/audit/application/audit-logger.port';
import { AdminScope } from '../../../../platform/auth/domain/admin-scope';
import { InvoicePaymentWriter } from '../../../billing/application/services/invoice-payment-writer';
import { InvoicePaymentStatus } from '../../../billing/domain/invoice-payment-status';
import { PaymentsService } from '../../application/services/payments.service';
import { deriveInvoicePayment } from '../../domain/derive-invoice-payment';
import { MAX_MINOR_UNITS } from '../../domain/money-limits';
import { PaymentMethod } from '../../domain/payment-method';
import { PaymentRecordStatus } from '../../domain/payment-record-status';
import { PaymentType } from '../../domain/payment-type';
import { PaymentEntity } from '../../infrastructure/persistence/payment.entity';

// Wrap the pure derivation so the happy path can assert its arguments and
// its place in the call order; behaviour stays the real one.
jest.mock('../../domain/derive-invoice-payment', () => {
  const actual = jest.requireActual<
    typeof import('../../domain/derive-invoice-payment')
  >('../../domain/derive-invoice-payment');
  return {
    ...actual,
    deriveInvoicePayment: jest.fn(actual.deriveInvoicePayment),
  };
});

const deriveMock = deriveInvoicePayment as jest.MockedFunction<
  typeof deriveInvoicePayment
>;

const TENANT = 't-a';
const ACTOR = 'actor-1';
const INVOICE_ID = 'invoice-1';
const KEY = '5f0c7a8e-1b2c-4d3e-8f90-a1b2c3d4e5f6';
const OTHER_KEY = '6a1d8b9f-2c3d-4e4f-9a01-b2c3d4e5f6a7';
// Deterministic, non-v4 fixture id: A1 checks syntax only (spec §4.5).
const FIXTURE_KEY = '00000000-0000-0000-0001-000000000001';
// The invalid keys of the Task 1 `isCanonicalUuid` spec.
const INVALID_KEYS = [
  '',
  'not-a-uuid',
  '5f0c7a8e1b2c4d3e8f90a1b2c3d4e5f6',
  '5f0c7a8e-1b2c-4d3e-8f90-a1b2c3d4e5f',
  '5f0c7a8e-1b2c-4d3e-8f90-a1b2c3d4e5fg',
  ' 5f0c7a8e-1b2c-4d3e-8f90-a1b2c3d4e5f6 ',
];
const CONFLICT_MESSAGE =
  'This request key was already used for a different entry. Close the dialog and start a new entry.';

type Row = Omit<PaymentEntity, 'invoice' | 'tenant'>;
type Where = Record<string, unknown>;

const matches = (row: Row, where: Where): boolean =>
  Object.entries(where).every(
    ([key, value]) => (row as unknown as Where)[key] === value,
  );

const past = (minutesAgo: number): Date =>
  new Date(Date.now() - minutesAgo * 60_000);

// Mocked manager over an in-memory row set (the `invoices.service.spec.ts`
// style): `findOne`/`find`/`findOneByOrFail` filter `rows` by equality on
// the `where` keys; `save` appends.
describe('PaymentsService', () => {
  let service: PaymentsService;
  let rows: Row[];
  let invoice: {
    id: string;
    tenantId: string;
    totalMinorUnits: number;
    paymentStatus: InvoicePaymentStatus;
  } | null;
  let manager: {
    create: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    findOneByOrFail: jest.Mock;
    save: jest.Mock;
  };
  let dataSource: { query: jest.Mock; transaction: jest.Mock };
  let writer: { applyDerivedPayment: jest.Mock; lockForPayment: jest.Mock };
  let auditLogger: { log: jest.Mock };
  let created = 0;

  const aRow = (over: Partial<Row> = {}): Row => ({
    id: `row-${++created}`,
    invoiceId: INVOICE_ID,
    recordedByStaffId: ACTOR,
    refundedPaymentId: null,
    tenantId: TENANT,
    amountMinorUnits: 400,
    createdAt: past(60),
    idempotencyKey: `00000000-0000-0000-0000-${String(created).padStart(12, '0')}`,
    method: PaymentMethod.CASH,
    paidAt: past(60),
    reference: null,
    status: PaymentRecordStatus.COMPLETED,
    type: PaymentType.PAYMENT,
    ...over,
  });

  beforeEach(async () => {
    created = 0;
    rows = [];
    invoice = {
      id: INVOICE_ID,
      tenantId: TENANT,
      paymentStatus: InvoicePaymentStatus.UNPAID,
      totalMinorUnits: 1000,
    };
    manager = {
      create: jest.fn((_entity: unknown, data: Partial<Row>) =>
        Object.assign(new PaymentEntity(), data),
      ),
      find: jest.fn((_entity: unknown, options: { where: Where }) =>
        Promise.resolve(rows.filter((r) => matches(r, options.where))),
      ),
      findOne: jest.fn((_entity: unknown, options: { where: Where }) =>
        Promise.resolve(rows.find((r) => matches(r, options.where)) ?? null),
      ),
      findOneByOrFail: jest.fn((_entity: unknown, where: Where) => {
        const row = rows.find((r) => matches(r, where));
        return row
          ? Promise.resolve({ ...row })
          : Promise.reject(new Error('not found'));
      }),
      save: jest.fn((entity: PaymentEntity) => {
        const row = {
          ...entity,
          id: `inserted-${++created}`,
          createdAt: new Date(),
        } as Row;
        rows.push(row);
        return Promise.resolve(Object.assign(entity, row));
      }),
    };
    dataSource = {
      query: jest.fn().mockResolvedValue([]),
      transaction: jest.fn((fn: (m: unknown) => unknown) => fn(manager)),
    };
    writer = {
      applyDerivedPayment: jest.fn().mockResolvedValue(undefined),
      lockForPayment: jest.fn(() => Promise.resolve(invoice)),
    };
    auditLogger = { log: jest.fn().mockResolvedValue(undefined) };
    deriveMock.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: DataSource, useValue: dataSource },
        { provide: InvoicePaymentWriter, useValue: writer },
        { provide: AUDIT_LOGGER, useValue: auditLogger },
      ],
    }).compile();

    service = module.get(PaymentsService);
  });

  const expectNoWrite = () => {
    expect(manager.save).not.toHaveBeenCalled();
    expect(writer.applyDerivedPayment).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  };

  describe('record', () => {
    const cmd = (over = {}) => ({
      actorId: ACTOR,
      invoiceId: INVOICE_ID,
      tenantId: TENANT,
      amountMinorUnits: 400,
      idempotencyKey: KEY,
      method: PaymentMethod.CASH,
      ...over,
    });

    describe('A-checks (before the transaction)', () => {
      it.each(INVALID_KEYS)(
        'A1: rejects key %j before opening the transaction',
        async (idempotencyKey) => {
          await expect(
            service.record(cmd({ idempotencyKey })),
          ).rejects.toBeInstanceOf(BadRequestException);
          expect(dataSource.transaction).not.toHaveBeenCalled();
        },
      );

      it('A1: accepts the non-v4 fixture key', async () => {
        await expect(
          service.record(cmd({ idempotencyKey: FIXTURE_KEY })),
        ).resolves.toMatchObject({ idempotencyKey: FIXTURE_KEY });
      });

      it.each([0, -1, 1.5, MAX_MINOR_UNITS + 1, Number.NaN])(
        'A2: rejects amount %p before opening the transaction',
        async (amountMinorUnits) => {
          await expect(
            service.record(cmd({ amountMinorUnits })),
          ).rejects.toBeInstanceOf(BadRequestException);
          expect(dataSource.transaction).not.toHaveBeenCalled();
        },
      );

      it('A3: counts code points — 120 emoji pass, 121 fail', async () => {
        await expect(
          service.record(cmd({ reference: '😀'.repeat(120) })),
        ).resolves.toMatchObject({ reference: '😀'.repeat(120) });

        await expect(
          service.record(
            cmd({ idempotencyKey: OTHER_KEY, reference: '😀'.repeat(121) }),
          ),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      });

      it('A3: trims the reference before measuring and stores blank as null', async () => {
        await expect(
          service.record(cmd({ reference: `  ${'a'.repeat(120)}  ` })),
        ).resolves.toMatchObject({ reference: 'a'.repeat(120) });
        await expect(
          service.record(cmd({ idempotencyKey: OTHER_KEY, reference: '   ' })),
        ).resolves.toMatchObject({ reference: null });
      });

      it('A4: rejects a supplied paidAt later than now', async () => {
        await expect(
          service.record(cmd({ paidAt: new Date(Date.now() + 60_000) })),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(dataSource.transaction).not.toHaveBeenCalled();
      });

      it('only the first failing check reports: invalid key + amount 0 → the key error', async () => {
        await expect(
          service.record(cmd({ idempotencyKey: 'nope', amountMinorUnits: 0 })),
        ).rejects.toThrow(/request key/i);
      });

      it('only the first failing check reports: amount 0 + 121-char reference → the amount error', async () => {
        await expect(
          service.record(
            cmd({ amountMinorUnits: 0, reference: 'a'.repeat(121) }),
          ),
        ).rejects.toThrow(/amount/i);
      });
    });

    describe('B-checks (under the invoice lock)', () => {
      it('B1: an invoice missing in the tenant → NotFoundException', async () => {
        invoice = null;
        await expect(service.record(cmd())).rejects.toBeInstanceOf(
          NotFoundException,
        );
        expect(writer.lockForPayment).toHaveBeenCalledWith(
          manager,
          INVOICE_ID,
          TENANT,
        );
        expectNoWrite();
      });

      it('B2: an identical replay returns the existing row with no write and no audit', async () => {
        const existing = aRow({ idempotencyKey: KEY });
        rows.push(existing);

        await expect(service.record(cmd())).resolves.toEqual(existing);
        expectNoWrite();
      });

      it('B2: a replay that supplies the same paidAt and reference matches', async () => {
        const paidAt = past(30);
        const existing = aRow({ idempotencyKey: KEY, paidAt, reference: 'R1' });
        rows.push(existing);

        await expect(
          service.record(
            cmd({ paidAt: new Date(paidAt.getTime()), reference: ' R1 ' }),
          ),
        ).resolves.toEqual(existing);
        expectNoWrite();
      });

      it.each([
        ['a different amount', { amountMinorUnits: 401 }],
        ['a different method', { method: PaymentMethod.GCASH }],
        ['a different reference', { reference: 'R2' }],
        ['a different invoice', { invoiceId: 'invoice-2' }],
        ['a different supplied paidAt', { paidAt: past(5) }],
      ])(
        'B2: a same-key replay with %s → ConflictException',
        async (_label, over) => {
          rows.push(aRow({ idempotencyKey: KEY }));
          invoice = {
            ...invoice!,
            id: (over as { invoiceId?: string }).invoiceId ?? INVOICE_ID,
          };

          const attempt = service.record(cmd(over));
          await expect(attempt).rejects.toBeInstanceOf(ConflictException);
          await expect(attempt).rejects.toThrow(CONFLICT_MESSAGE);
          expectNoWrite();
        },
      );

      it('B2: a key already used by a refund → ConflictException', async () => {
        const original = aRow();
        rows.push(
          original,
          aRow({
            refundedPaymentId: original.id,
            amountMinorUnits: 400,
            idempotencyKey: KEY,
            type: PaymentType.REFUND,
          }),
        );
        await expect(service.record(cmd())).rejects.toBeInstanceOf(
          ConflictException,
        );
      });

      it('B3: a VOID invoice → BadRequestException', async () => {
        invoice!.paymentStatus = InvoicePaymentStatus.VOID;
        await expect(service.record(cmd())).rejects.toBeInstanceOf(
          BadRequestException,
        );
        expectNoWrite();
      });

      it('B7: net 2147483646 + 1 is inserted', async () => {
        rows.push(aRow({ amountMinorUnits: MAX_MINOR_UNITS - 1 }));
        await expect(
          service.record(cmd({ amountMinorUnits: 1 })),
        ).resolves.toMatchObject({ amountMinorUnits: 1 });
        expect(manager.save).toHaveBeenCalledTimes(1);
      });

      it('B7: net 2147483646 + 2 → BadRequestException naming 1', async () => {
        rows.push(aRow({ amountMinorUnits: MAX_MINOR_UNITS - 1 }));
        const attempt = service.record(cmd({ amountMinorUnits: 2 }));
        await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
        await expect(attempt).rejects.toThrow(
          /largest amount that can still be recorded is ₱0\.01\./,
        );
        expectNoWrite();
      });

      it('B7: nets completed refunds and ignores non-completed rows', async () => {
        const p = aRow({ amountMinorUnits: MAX_MINOR_UNITS });
        rows.push(
          p,
          aRow({
            type: PaymentType.REFUND,
            refundedPaymentId: p.id,
            amountMinorUnits: 10,
          }),
          aRow({
            amountMinorUnits: 500,
            status: PaymentRecordStatus.PENDING,
          }),
        );
        await expect(
          service.record(cmd({ amountMinorUnits: 10 })),
        ).resolves.toMatchObject({ amountMinorUnits: 10 });
        await expect(
          service.record(
            cmd({ idempotencyKey: OTHER_KEY, amountMinorUnits: 1 }),
          ),
        ).rejects.toThrow(/₱0\.00\./);
      });
    });

    it('happy path: lock → insert → derive → applyDerivedPayment → audit, returning the re-read row', async () => {
      const prior = aRow({ amountMinorUnits: 300 });
      rows.push(prior);
      const paidAt = past(10);

      const result = await service.record(
        cmd({ paidAt, reference: '  GC-123 ', method: PaymentMethod.GCASH }),
      );

      expect(manager.create).toHaveBeenCalledWith(PaymentEntity, {
        invoiceId: INVOICE_ID,
        recordedByStaffId: ACTOR,
        refundedPaymentId: null,
        tenantId: TENANT,
        amountMinorUnits: 400,
        idempotencyKey: KEY,
        method: PaymentMethod.GCASH,
        paidAt,
        reference: 'GC-123',
        status: PaymentRecordStatus.COMPLETED,
        type: PaymentType.PAYMENT,
      });
      const inserted = rows[rows.length - 1];
      expect(deriveMock).toHaveBeenCalledWith({
        totalMinorUnits: 1000,
        currentStatus: InvoicePaymentStatus.UNPAID,
        rows: [prior, inserted],
      });
      expect(writer.applyDerivedPayment).toHaveBeenCalledWith(
        manager,
        invoice,
        {
          amountPaidMinorUnits: 700,
          paymentStatus: InvoicePaymentStatus.PARTIALLY_PAID,
        },
      );
      expect(auditLogger.log).toHaveBeenCalledWith({
        actorId: ACTOR,
        entityId: inserted.id,
        tenantId: TENANT,
        action: 'payment.recorded',
        entityType: 'payment',
        scope: AdminScope.TENANT,
      });

      const order = [
        writer.lockForPayment,
        manager.save,
        deriveMock,
        writer.applyDerivedPayment,
        auditLogger.log,
      ].map((m) => m.mock.invocationCallOrder[0]);
      expect(order).toEqual([...order].sort((a, b) => a - b));

      expect(manager.findOneByOrFail).toHaveBeenLastCalledWith(PaymentEntity, {
        id: inserted.id,
        tenantId: TENANT,
      });
      expect(result).toEqual(inserted);
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    });

    it('defaults paidAt to the server now', async () => {
      const before = Date.now();
      const result = await service.record(cmd());
      expect(result.paidAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.paidAt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('inserts through manager.save with exactly one PaymentEntity argument (decision p)', async () => {
      await service.record(cmd());
      expect(manager.save).toHaveBeenCalledTimes(1);
      const args = manager.save.mock.calls[0] as unknown[];
      expect(args).toHaveLength(1);
      expect(args[0]).toBeInstanceOf(PaymentEntity);
    });

    it('maps a uq_payment_tenant_idempotency_key violation on insert to ConflictException', async () => {
      manager.save.mockRejectedValueOnce({
        code: '23505',
        constraint: 'uq_payment_tenant_idempotency_key',
      });
      const attempt = service.record(cmd());
      await expect(attempt).rejects.toBeInstanceOf(ConflictException);
      await expect(attempt).rejects.toThrow(CONFLICT_MESSAGE);
      expect(writer.applyDerivedPayment).not.toHaveBeenCalled();
      expect(auditLogger.log).not.toHaveBeenCalled();
    });

    it('rethrows a unique violation on any other constraint unchanged', async () => {
      const failure = { code: '23505', constraint: 'payment_entity_pkey' };
      manager.save.mockRejectedValueOnce(failure);
      await expect(service.record(cmd())).rejects.toBe(failure);
    });

    it('rethrows any other insert failure unchanged', async () => {
      const failure = {
        code: '23503',
        constraint: 'fk_payment_invoice_tenant',
      };
      manager.save.mockRejectedValueOnce(failure);
      await expect(service.record(cmd())).rejects.toBe(failure);
    });

    // The real Postgres path: TypeORM wraps the driver error.
    it('maps a real QueryFailedError on uq_payment_tenant_idempotency_key to ConflictException', async () => {
      manager.save.mockRejectedValueOnce(
        new QueryFailedError('INSERT INTO "payment" ...', [], {
          code: '23505',
          constraint: 'uq_payment_tenant_idempotency_key',
        } as unknown as Error),
      );
      const attempt = service.record(cmd());
      await expect(attempt).rejects.toBeInstanceOf(ConflictException);
      await expect(attempt).rejects.toThrow(CONFLICT_MESSAGE);
      expect(writer.applyDerivedPayment).not.toHaveBeenCalled();
      expect(auditLogger.log).not.toHaveBeenCalled();
    });

    it.each([
      [
        'another constraint',
        { code: '23505', constraint: 'payment_entity_pkey' },
      ],
      [
        'another code',
        { code: '23503', constraint: 'uq_payment_tenant_idempotency_key' },
      ],
    ])(
      'rethrows a real QueryFailedError on %s unchanged',
      async (_label, driverError) => {
        const failure = new QueryFailedError(
          'INSERT INTO "payment" ...',
          [],
          driverError as unknown as Error,
        );
        manager.save.mockRejectedValueOnce(failure);
        await expect(service.record(cmd())).rejects.toBe(failure);
      },
    );
  });

  describe('refund', () => {
    let original: Row;

    const cmd = (over = {}) => ({
      actorId: ACTOR,
      paymentId: original.id,
      tenantId: TENANT,
      amountMinorUnits: 100,
      idempotencyKey: KEY,
      method: PaymentMethod.CASH,
      ...over,
    });

    beforeEach(() => {
      original = aRow({ amountMinorUnits: 400, paidAt: past(120) });
      rows.push(original);
      invoice!.paymentStatus = InvoicePaymentStatus.PARTIALLY_PAID;
    });

    it.each(INVALID_KEYS)(
      'A1: rejects key %j before opening the transaction',
      async (idempotencyKey) => {
        await expect(
          service.refund(cmd({ idempotencyKey })),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(dataSource.transaction).not.toHaveBeenCalled();
      },
    );

    it('A1: accepts the non-v4 fixture key', async () => {
      await expect(
        service.refund(cmd({ idempotencyKey: FIXTURE_KEY })),
      ).resolves.toMatchObject({ idempotencyKey: FIXTURE_KEY });
    });

    it.each([0, -5, 2.5, MAX_MINOR_UNITS + 1])(
      'A2: rejects amount %p before opening the transaction',
      async (amountMinorUnits) => {
        await expect(
          service.refund(cmd({ amountMinorUnits })),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(dataSource.transaction).not.toHaveBeenCalled();
      },
    );

    it('A3: rejects a 121-code-point reference before the transaction', async () => {
      await expect(
        service.refund(cmd({ reference: '😀'.repeat(121) })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('A4: rejects a supplied paidAt later than now', async () => {
      await expect(
        service.refund(cmd({ paidAt: new Date(Date.now() + 60_000) })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('B1: an original missing in the tenant → NotFoundException before any lock', async () => {
      await expect(
        service.refund(cmd({ paymentId: 'missing' })),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(manager.findOne).toHaveBeenCalledWith(PaymentEntity, {
        where: { id: 'missing', tenantId: TENANT },
      });
      expect(writer.lockForPayment).not.toHaveBeenCalled();
      expectNoWrite();
    });

    it('B1: the re-read under the lock missing → NotFoundException', async () => {
      manager.findOne
        .mockResolvedValueOnce(original)
        .mockResolvedValueOnce(null);
      await expect(service.refund(cmd())).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(writer.lockForPayment).toHaveBeenCalledWith(
        manager,
        INVOICE_ID,
        TENANT,
      );
      expectNoWrite();
    });

    it('B2: a replay of a refund whose original is now fully refunded returns the refund (B2 precedes B6)', async () => {
      const refund = aRow({
        refundedPaymentId: original.id,
        amountMinorUnits: 400,
        idempotencyKey: KEY,
        type: PaymentType.REFUND,
      });
      rows.push(refund);

      await expect(
        service.refund(cmd({ amountMinorUnits: 400 })),
      ).resolves.toEqual(refund);
      expectNoWrite();
    });

    it('B2: a same-key replay with a different amount → ConflictException', async () => {
      rows.push(
        aRow({
          refundedPaymentId: original.id,
          amountMinorUnits: 100,
          idempotencyKey: KEY,
          type: PaymentType.REFUND,
        }),
      );
      const attempt = service.refund(cmd({ amountMinorUnits: 50 }));
      await expect(attempt).rejects.toBeInstanceOf(ConflictException);
      await expect(attempt).rejects.toThrow(CONFLICT_MESSAGE);
      expectNoWrite();
    });

    it('B2: a key already used by a payment → ConflictException', async () => {
      rows.push(aRow({ idempotencyKey: KEY, amountMinorUnits: 100 }));
      await expect(service.refund(cmd())).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('B3: a VOID invoice → BadRequestException', async () => {
      invoice!.paymentStatus = InvoicePaymentStatus.VOID;
      await expect(service.refund(cmd())).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expectNoWrite();
    });

    it('only the first failing check reports: VOID invoice + over-refund → the VOID error', async () => {
      invoice!.paymentStatus = InvoicePaymentStatus.VOID;
      await expect(
        service.refund(cmd({ amountMinorUnits: 401 })),
      ).rejects.toThrow(/void/i);
    });

    it('B4: an original that is a REFUND → BadRequestException', async () => {
      const refund = aRow({
        type: PaymentType.REFUND,
        refundedPaymentId: original.id,
        amountMinorUnits: 50,
      });
      rows.push(refund);
      await expect(
        service.refund(cmd({ paymentId: refund.id, amountMinorUnits: 10 })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expectNoWrite();
    });

    it('B4: an original that is not COMPLETED → BadRequestException', async () => {
      original.status = PaymentRecordStatus.FAILED;
      await expect(service.refund(cmd())).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expectNoWrite();
    });

    it('B5: a defaulted paidAt before the original paidAt (original in the future of now) → BadRequestException', async () => {
      original.paidAt = new Date(Date.now() + 3_600_000);
      await expect(service.refund(cmd())).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expectNoWrite();
    });

    it('B5: a supplied paidAt before the original paidAt → BadRequestException', async () => {
      await expect(
        service.refund(cmd({ paidAt: past(180) })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expectNoWrite();
    });

    it('B5: a paidAt equal to the original paidAt passes', async () => {
      await expect(
        service.refund(cmd({ paidAt: new Date(original.paidAt.getTime()) })),
      ).resolves.toBeDefined();
    });

    it('B6: an amount above the refundable amount → BadRequestException naming it', async () => {
      rows.push(
        aRow({
          type: PaymentType.REFUND,
          refundedPaymentId: original.id,
          amountMinorUnits: 100,
        }),
        aRow({
          refundedPaymentId: original.id,
          amountMinorUnits: 999,
          status: PaymentRecordStatus.FAILED,
          type: PaymentType.REFUND,
        }),
      );
      const attempt = service.refund(cmd({ amountMinorUnits: 301 }));
      await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
      await expect(attempt).rejects.toThrow(/refundable amount of ₱3\.00\./);
      expectNoWrite();

      await expect(
        service.refund(cmd({ amountMinorUnits: 300 })),
      ).resolves.toMatchObject({ amountMinorUnits: 300 });
    });

    it('happy path: pre-lock read → lock → insert → derive → applyDerivedPayment → audit', async () => {
      rows.push(aRow({ amountMinorUnits: 600 }));
      invoice!.paymentStatus = InvoicePaymentStatus.PAID;

      const result = await service.refund(
        cmd({ amountMinorUnits: 150, method: PaymentMethod.MAYA }),
      );

      const createArgs = manager.create.mock.calls[0] as [
        unknown,
        Record<string, unknown>,
      ];
      expect(createArgs[0]).toBe(PaymentEntity);
      expect(createArgs[1]).toMatchObject({
        invoiceId: INVOICE_ID,
        recordedByStaffId: ACTOR,
        refundedPaymentId: original.id,
        tenantId: TENANT,
        amountMinorUnits: 150,
        idempotencyKey: KEY,
        method: PaymentMethod.MAYA,
        reference: null,
        status: PaymentRecordStatus.COMPLETED,
        type: PaymentType.REFUND,
      });
      const inserted = rows[rows.length - 1];
      expect(deriveMock).toHaveBeenCalledWith({
        totalMinorUnits: 1000,
        currentStatus: InvoicePaymentStatus.PAID,
        rows: [...rows],
      });
      expect(writer.applyDerivedPayment).toHaveBeenCalledWith(
        manager,
        invoice,
        {
          amountPaidMinorUnits: 850,
          paymentStatus: InvoicePaymentStatus.PARTIALLY_PAID,
        },
      );
      expect(auditLogger.log).toHaveBeenCalledWith({
        actorId: ACTOR,
        entityId: inserted.id,
        tenantId: TENANT,
        action: 'payment.refunded',
        entityType: 'payment',
        scope: AdminScope.TENANT,
      });

      const order = [
        manager.findOne,
        writer.lockForPayment,
        manager.save,
        deriveMock,
        writer.applyDerivedPayment,
        auditLogger.log,
      ].map((m) => m.mock.invocationCallOrder[0]);
      expect(order).toEqual([...order].sort((a, b) => a - b));
      expect(result).toEqual(inserted);
    });

    it('inserts through manager.save with exactly one PaymentEntity argument (decision p)', async () => {
      await service.refund(cmd());
      const args = manager.save.mock.calls[0] as unknown[];
      expect(args).toHaveLength(1);
      expect(args[0]).toBeInstanceOf(PaymentEntity);
    });

    it('maps a uq_payment_tenant_idempotency_key violation on insert to ConflictException', async () => {
      manager.save.mockRejectedValueOnce({
        code: '23505',
        constraint: 'uq_payment_tenant_idempotency_key',
      });
      await expect(service.refund(cmd())).rejects.toThrow(CONFLICT_MESSAGE);
      expect(auditLogger.log).not.toHaveBeenCalled();
    });
  });

  describe('refundableByPaymentIds', () => {
    it('returns an empty map without querying when no ids are given', async () => {
      await expect(service.refundableByPaymentIds([], TENANT)).resolves.toEqual(
        new Map(),
      );
      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('runs one tenant-scoped grouped query and returns amount − refunded', async () => {
      dataSource.query.mockResolvedValueOnce([
        { id: 'p-1', amountMinorUnits: 1000, refundedMinorUnits: '300' },
        { id: 'p-2', amountMinorUnits: 500, refundedMinorUnits: '0' },
      ]);

      const result = await service.refundableByPaymentIds(
        ['p-1', 'p-2', 'p-3'],
        TENANT,
      );

      expect(result).toEqual(
        new Map([
          ['p-1', 700],
          ['p-2', 500],
        ]),
      );
      expect(dataSource.query).toHaveBeenCalledTimes(1);
      const [sql, params] = dataSource.query.mock.calls[0] as [
        string,
        unknown[],
      ];
      expect(sql).toMatch(/LEFT JOIN "payment_entity" r/);
      expect(sql).toMatch(/r\."tenantId" = p\."tenantId"/);
      expect(sql).toMatch(
        /COALESCE\(SUM\(r\."amountMinorUnits"\) FILTER \(WHERE r\."status" = 'COMPLETED'\), 0\)::text/,
      );
      expect(sql).toMatch(/GROUP BY p\."id"/);
      expect(params).toEqual([['p-1', 'p-2', 'p-3'], TENANT]);
    });

    it('throws when a returned sum is not a safe integer', async () => {
      dataSource.query.mockResolvedValueOnce([
        {
          id: 'p-1',
          amountMinorUnits: 1000,
          refundedMinorUnits: '9007199254740993',
        },
      ]);
      await expect(
        service.refundableByPaymentIds(['p-1'], TENANT),
      ).rejects.toThrow();
    });
  });
});
