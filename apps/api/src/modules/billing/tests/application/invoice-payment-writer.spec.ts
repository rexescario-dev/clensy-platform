import type { EntityManager } from 'typeorm';
import { InvoicePaymentWriter } from '../../application/services/invoice-payment-writer';
import { InvoicePaymentStatus } from '../../domain/invoice-payment-status';
import { InvoiceEntity } from '../../infrastructure/persistence/invoice.entity';

const SQL =
  'UPDATE "invoice_entity" SET "amountPaidMinorUnits" = $1, "paymentStatus" = $2 WHERE "id" = $3 AND "tenantId" = $4';

describe('InvoicePaymentWriter', () => {
  const writer = new InvoicePaymentWriter();
  const findOne = jest.fn();
  const query = jest.fn();
  const manager = { findOne, query } as unknown as EntityManager;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('lockForPayment', () => {
    it('takes a pessimistic write lock scoped by id and tenant', async () => {
      const invoice = { id: 'inv-1', tenantId: 't-1' };
      findOne.mockResolvedValue(invoice);

      await expect(
        writer.lockForPayment(manager, 'inv-1', 't-1'),
      ).resolves.toBe(invoice);
      expect(findOne).toHaveBeenCalledWith(InvoiceEntity, {
        lock: { mode: 'pessimistic_write' },
        where: { id: 'inv-1', tenantId: 't-1' },
      });
    });

    it('returns null when no invoice matches', async () => {
      findOne.mockResolvedValue(null);
      await expect(
        writer.lockForPayment(manager, 'inv-1', 't-1'),
      ).resolves.toBeNull();
    });
  });

  describe('applyDerivedPayment', () => {
    const derived = {
      amountPaidMinorUnits: 500,
      paymentStatus: InvoicePaymentStatus.PARTIALLY_PAID,
    };

    it('writes only the two payment columns, scoped by id and tenant', async () => {
      query.mockResolvedValue([[], 1]);

      await writer.applyDerivedPayment(
        manager,
        { id: 'inv-1', tenantId: 't-1' },
        derived,
      );

      expect(query).toHaveBeenCalledTimes(1);
      expect(query).toHaveBeenCalledWith(SQL, [
        500,
        InvoicePaymentStatus.PARTIALLY_PAID,
        'inv-1',
        't-1',
      ]);
    });

    it.each([0, 2])('throws when %i rows are affected', async (count) => {
      query.mockResolvedValue([[], count]);
      await expect(
        writer.applyDerivedPayment(
          manager,
          { id: 'inv-1', tenantId: 't-1' },
          derived,
        ),
      ).rejects.toThrow();
    });
  });
});
