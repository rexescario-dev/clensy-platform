import { InvoicePaymentStatus } from '../../../billing/domain/invoice-payment-status';
import {
  deriveInvoicePayment,
  PaymentRowForDerivation,
} from '../../domain/derive-invoice-payment';
import { MAX_MINOR_UNITS } from '../../domain/money-limits';
import { PaymentRecordStatus } from '../../domain/payment-record-status';
import { PaymentType } from '../../domain/payment-type';

const row = (
  type: PaymentType,
  amountMinorUnits: number,
  status: PaymentRecordStatus = PaymentRecordStatus.COMPLETED,
): PaymentRowForDerivation => ({ type, status, amountMinorUnits });
const P = (amount: number) => row(PaymentType.PAYMENT, amount);
const R = (amount: number) => row(PaymentType.REFUND, amount);

const derive = (
  rows: PaymentRowForDerivation[],
  totalMinorUnits = 1000,
  currentStatus = InvoicePaymentStatus.UNPAID,
) => deriveInvoicePayment({ totalMinorUnits, currentStatus, rows });

describe('deriveInvoicePayment', () => {
  const S = InvoicePaymentStatus;
  const table: [
    string,
    PaymentRowForDerivation[],
    number,
    InvoicePaymentStatus,
  ][] = [
    ['no rows', [], 0, S.UNPAID],
    ['P400', [P(400)], 400, S.PARTIALLY_PAID],
    ['P400,P600', [P(400), P(600)], 1000, S.PAID],
    ['P400,P600,P200', [P(400), P(600), P(200)], 1200, S.OVERPAID],
    ['+R200', [P(400), P(600), P(200), R(200)], 1000, S.PAID],
    ['+R100', [P(400), P(600), P(200), R(200), R(100)], 900, S.PARTIALLY_PAID],
    [
      '+R500',
      [P(400), P(600), P(200), R(200), R(100), R(500)],
      400,
      S.PARTIALLY_PAID,
    ],
    [
      '+R400',
      [P(400), P(600), P(200), R(200), R(100), R(500), R(400)],
      0,
      S.REFUNDED,
    ],
    [
      '+P1000',
      [P(400), P(600), P(200), R(200), R(100), R(500), R(400), P(1000)],
      1000,
      S.PAID,
    ],
  ];

  it.each(table)('worked example: %s', (_name, rows, paid, status) => {
    expect(derive(rows)).toEqual({
      amountPaidMinorUnits: paid,
      paymentStatus: status,
    });
  });

  it('ignores PENDING and FAILED rows', () => {
    const rows = [
      P(400),
      row(PaymentType.PAYMENT, 500, PaymentRecordStatus.PENDING),
      row(PaymentType.PAYMENT, 500, PaymentRecordStatus.FAILED),
    ];
    expect(derive(rows)).toEqual({
      amountPaidMinorUnits: 400,
      paymentStatus: S.PARTIALLY_PAID,
    });
  });

  it('keeps a zero-total invoice with no rows UNPAID', () => {
    expect(derive([], 0)).toEqual({
      amountPaidMinorUnits: 0,
      paymentStatus: S.UNPAID,
    });
  });

  it('marks any payment on a zero-total invoice OVERPAID', () => {
    expect(derive([P(1)], 0)).toEqual({
      amountPaidMinorUnits: 1,
      paymentStatus: S.OVERPAID,
    });
  });

  it('throws for a VOID invoice', () => {
    expect(() => derive([], 1000, S.VOID)).toThrow();
  });

  it('throws RangeError when net is negative', () => {
    expect(() => derive([P(100), R(200)])).toThrow(RangeError);
  });

  it('accepts net paid equal to MAX_MINOR_UNITS', () => {
    expect(derive([P(MAX_MINOR_UNITS)])).toEqual({
      amountPaidMinorUnits: MAX_MINOR_UNITS,
      paymentStatus: S.OVERPAID,
    });
  });

  it('throws RangeError when net exceeds MAX_MINOR_UNITS', () => {
    expect(() => derive([P(MAX_MINOR_UNITS), P(1)])).toThrow(RangeError);
  });
});
