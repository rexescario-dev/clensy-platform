import { EntityManager } from 'typeorm';
import { allocateInvoiceNumber } from '../../infrastructure/persistence/invoice-number-counter';

// #87 slice decision 9 (F1, F7): the per-tenant allocator is one upsert on
// the caller's (transaction) manager, and returns only a positive
// JavaScript safe integer.
describe('allocateInvoiceNumber', () => {
  const managerReturning = (rows: unknown[]) => {
    const query = jest.fn().mockResolvedValue(rows);
    return { manager: { query } as unknown as EntityManager, query };
  };

  it('runs the counter upsert for the tenant and returns the value as a number', async () => {
    const { manager, query } = managerReturning([{ lastValue: '7' }]);

    await expect(allocateInvoiceNumber(manager, 't1')).resolves.toBe(7);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      'INSERT INTO "invoice_number_counter" ("tenantId", "lastValue") VALUES ($1, 1) ON CONFLICT ("tenantId") DO UPDATE SET "lastValue" = "invoice_number_counter"."lastValue" + 1 RETURNING "lastValue"',
      ['t1'],
    );
  });

  it('accepts the maximum safe integer exactly', async () => {
    const { manager } = managerReturning([{ lastValue: '9007199254740991' }]);
    await expect(allocateInvoiceNumber(manager, 't1')).resolves.toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it.each([
    ['no row', []],
    ['zero', [{ lastValue: '0' }]],
    [
      'a value above Number.MAX_SAFE_INTEGER',
      [{ lastValue: '9007199254740992' }],
    ],
    ['a non-numeric value', [{ lastValue: 'x' }]],
  ])(
    'throws instead of returning a wrong number for %s',
    async (_label, rows) => {
      const { manager } = managerReturning(rows);
      await expect(allocateInvoiceNumber(manager, 't1')).rejects.toThrow(
        /Invoice number counter/,
      );
    },
  );
});
