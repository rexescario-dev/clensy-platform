'use client';

import { useAdminsQuery, type PaymentMethod, type PaymentRowFragment, type Role } from '@clensy/client';
import {
  Button,
  FormDialog,
  FormField,
  LoadingState,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@clensy/ui';
import { useClensyTranslations } from '@clensy/web';
import { useState, type ReactNode } from 'react';
import { formatMinorUnits, toEditableAmount } from '../../lib/format-price';
import {
  amountDueView,
  canRecordPayment,
  canRefundPayment,
  MAX_MINOR_UNITS,
  newIdempotencyKey,
  parsePaymentAmount,
  recordAmountPrefill,
  recordedByLabel,
  type ParsedPaymentAmount,
} from '../../lib/invoice-payments';
import { INVOICE_PAYMENT_STATUS_TONE } from '../../lib/invoice-payment-status';
import { formatManilaDateTime, manilaDateTimeLocalToIso, toManilaDateTimeLocal } from '../../lib/manila-time';
import { useInvoicePaymentHistory } from '../../lib/use-invoice-payment-history';
import { useInvoicePaymentMutations } from '../../lib/use-invoice-payment-mutations';
import type { LaundryMutationLock } from '../../lib/use-laundry-mutation-lock';

type Translate = (key: string) => string;

export interface InvoicePaymentsPanelProps {
  invoiceId: string;
  role: Role | undefined;
  viewerId: string | undefined;
  // The laundry page's shared lock (planning decision i); the billing
  // drawer has none.
  lock?: LaundryMutationLock;
  // Runs after a successful write and the history reload, so the host can
  // refetch its own invoice view.
  onChanged?: () => Promise<unknown>;
}

const METHODS: readonly PaymentMethod[] = ['CASH', 'GCASH', 'MAYA', 'BANK_TRANSFER', 'CARD', 'OTHER'];

// A dialog's key is made when it opens and kept for every retry until it
// closes (spec §4.5); `session` remounts the form, so its fields reset.
type DialogState =
  | { idempotencyKey: string; kind: 'record'; now: Date; session: number }
  | { idempotencyKey: string; kind: 'refund'; now: Date; payment: PaymentRowFragment; session: number };

interface PaymentFields {
  amountMinorUnits: number;
  method: PaymentMethod;
  paidAt?: string;
  reference?: string;
}

// The invoice payments panel (spec §4.10): amounts, every history row, and
// the record and refund dialogs. Mounted on the laundry order page and in the
// billing drawer.
export function InvoicePaymentsPanel({ invoiceId, lock, onChanged, role, viewerId }: InvoicePaymentsPanelProps) {
  const t = useClensyTranslations('laundry');
  const history = useInvoicePaymentHistory(invoiceId);
  // Only a TENANT_OWNER can read `admins` (spec §4.10: no new staff read).
  const admins = useAdminsQuery({ skip: role !== 'TENANT_OWNER' });
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [sessions, setSessions] = useState(0);
  const mutations = useInvoicePaymentMutations({ invoiceId, lock, refetch: afterWrite });

  // Called by the write hook after a success toast: close, reload the
  // history, then let the host refetch.
  async function afterWrite() {
    setDialog(null);
    await history.reload();
    await onChanged?.();
  }

  function open(next: { kind: 'record' } | { kind: 'refund'; payment: PaymentRowFragment }) {
    const session = sessions + 1;
    setSessions(session);
    setDialog({ ...next, idempotencyKey: newIdempotencyKey(), now: new Date(), session });
  }

  if (history.loading) return <LoadingState />;
  const invoice = history.invoice;
  if (!invoice) {
    return (
      <p role="alert" className="text-sm text-red-600">
        {t('order.invoice.error')}
      </p>
    );
  }

  const status = invoice.paymentStatus;
  const due = amountDueView(invoice.amountDueMinorUnits);
  const busy = mutations.pending || Boolean(lock?.held);
  const staffEmails = new Map((admins.data?.admins ?? []).map((admin) => [admin.id, admin.email]));
  const byId = new Map(history.payments.map((row) => [row.id, row]));

  function describe(row: PaymentRowFragment): string {
    return `${formatManilaDateTime(row.paidAt as string)} · ${formatMinorUnits(row.amountMinorUnits)}`;
  }

  function recordedBy(row: PaymentRowFragment): string {
    const label = recordedByLabel({ recordedByStaffId: row.recordedByStaffId, viewerId, staffEmails, viewerRole: role });
    if (label.kind === 'you') return t('payments.recordedByYou');
    return label.kind === 'email' ? label.email : t('payments.recordedByStaff');
  }

  async function submit(fields: PaymentFields): Promise<boolean> {
    if (!dialog) return false;
    if (dialog.kind === 'record') return mutations.record({ ...fields, idempotencyKey: dialog.idempotencyKey });
    return mutations.refund({ ...fields, idempotencyKey: dialog.idempotencyKey, paymentId: dialog.payment.id });
  }

  return (
    <section className="flex flex-col gap-4" aria-label={t('payments.title')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-900">{t('payments.title')}</h4>
        <StatusBadge label={t(`invoicePaymentStatus.${status}`)} tone={INVOICE_PAYMENT_STATUS_TONE[status]} />
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <Amount label={t('payments.total')}>{formatMinorUnits(invoice.totalMinorUnits)}</Amount>
        <Amount label={t('payments.amountPaid')}>{formatMinorUnits(invoice.amountPaidMinorUnits)}</Amount>
        <Amount label={t('payments.amountDue')} testId="payments-amount-due">
          {due.kind === 'overpaid'
            ? t('payments.overpaidBy').replace('{amount}', formatMinorUnits(due.minorUnits))
            : formatMinorUnits(due.minorUnits)}
        </Amount>
      </dl>
      {canRecordPayment(role, status) ? (
        <div>
          <Button type="button" disabled={busy} onClick={() => open({ kind: 'record' })}>
            {t('payments.dialog.recordTitle')}
          </Button>
        </div>
      ) : null}
      {history.payments.length === 0 ? (
        <p className="text-sm text-slate-600">{t('payments.empty')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('payments.columns.paidAt')}</TableHead>
              <TableHead>{t('payments.columns.type')}</TableHead>
              <TableHead>{t('payments.columns.method')}</TableHead>
              <TableHead className="text-right">{t('payments.columns.amount')}</TableHead>
              <TableHead>{t('payments.columns.reference')}</TableHead>
              <TableHead>{t('payments.columns.recordedBy')}</TableHead>
              <TableHead>
                <span className="sr-only">{t('payments.actionsHeader')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.payments.map((row) => {
              const original = row.refundedPaymentId ? byId.get(row.refundedPaymentId) : undefined;
              return (
                <TableRow key={row.id}>
                  <TableCell>{formatManilaDateTime(row.paidAt as string)}</TableCell>
                  <TableCell>
                    {t(`payments.type.${row.type}`)}
                    {original ? (
                      <span className="block text-xs text-slate-600">
                        {t('payments.refundOf').replace('{payment}', describe(original))}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>{t(`payments.method.${row.method}`)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMinorUnits(row.type === 'REFUND' ? -row.amountMinorUnits : row.amountMinorUnits)}
                  </TableCell>
                  <TableCell>{row.reference ?? ''}</TableCell>
                  <TableCell>{recordedBy(row)}</TableCell>
                  <TableCell className="text-right">
                    {canRefundPayment(role, status, row) ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => open({ kind: 'refund', payment: row })}
                      >
                        {t('payments.dialog.refundTitle')}
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      {history.hasNextPage ? (
        <div>
          <Button type="button" variant="secondary" disabled={history.loadingMore} onClick={() => void history.loadMore()}>
            {t('payments.loadMore')}
          </Button>
        </div>
      ) : null}
      {history.loadMoreFailed ? (
        <p role="alert" className="text-sm text-red-600">
          {t('payments.error.loadMore')}
        </p>
      ) : null}
      {dialog ? (
        <PaymentDialog
          key={dialog.session}
          initialAmount={
            dialog.kind === 'record'
              ? recordAmountPrefill(invoice.amountDueMinorUnits)
              : toEditableAmount(dialog.payment.refundableMinorUnits ?? 0)
          }
          initialMethod={dialog.kind === 'record' ? 'CASH' : dialog.payment.method}
          maxMinorUnits={dialog.kind === 'record' ? MAX_MINOR_UNITS : (dialog.payment.refundableMinorUnits ?? 0)}
          now={dialog.now}
          refund={dialog.kind === 'refund'}
          serverError={mutations.error}
          submitting={mutations.pending}
          t={t}
          onClose={() => setDialog(null)}
          onSubmit={submit}
        />
      ) : null}
    </section>
  );
}

function Amount({ children, label, testId }: { children: ReactNode; label: string; testId?: string }) {
  return (
    <>
      <dt className="text-slate-600">{label}</dt>
      <dd className="text-right font-medium tabular-nums text-slate-900" data-testid={testId}>
        {children}
      </dd>
    </>
  );
}

// The record and refund form. `paidAt` is sent only when the user changed
// it (spec §4.5), so client clock skew cannot reject a "now" payment.
function PaymentDialog({
  initialAmount,
  initialMethod,
  maxMinorUnits,
  now,
  onClose,
  onSubmit,
  refund,
  serverError,
  submitting,
  t,
}: {
  initialAmount: string;
  initialMethod: PaymentMethod;
  maxMinorUnits: number;
  now: Date;
  onClose: () => void;
  onSubmit: (fields: PaymentFields) => Promise<boolean>;
  refund: boolean;
  serverError: string | null;
  submitting: boolean;
  t: Translate;
}) {
  const nowLocal = toManilaDateTimeLocal(now);
  const [method, setMethod] = useState<PaymentMethod>(initialMethod);
  const [amount, setAmount] = useState(initialAmount);
  const [reference, setReference] = useState('');
  const [paidAt, setPaidAt] = useState(nowLocal);
  const [paidAtEdited, setPaidAtEdited] = useState(false);
  const [amountError, setAmountError] = useState<string | undefined>(undefined);
  const [paidAtInvalid, setPaidAtInvalid] = useState(false);
  const [failed, setFailed] = useState(false);

  function amountMessage(parsed: Extract<ParsedPaymentAmount, { ok: false }>): string {
    switch (parsed.error) {
      case 'invalid':
        return t('payments.error.amountInvalid');
      case 'overRefundable':
        return t('payments.error.refundExceeds').replace('{amount}', formatMinorUnits(maxMinorUnits));
      case 'tooLarge':
        return t('payments.error.amountTooLarge');
      case 'zero':
        return t('payments.error.amountZero');
    }
  }

  async function handleSubmit() {
    if (submitting) return;
    const parsed = parsePaymentAmount(amount, maxMinorUnits);
    const paidAtIso = paidAtEdited ? pastManilaInstant(paidAt) : undefined;
    const paidAtBad = paidAtEdited && paidAtIso === null;
    setAmountError(parsed.ok ? undefined : amountMessage(parsed));
    setPaidAtInvalid(paidAtBad);
    if (!parsed.ok || paidAtBad) return;
    setFailed(false);
    const trimmed = reference.trim();
    const ok = await onSubmit({
      amountMinorUnits: parsed.minorUnits,
      method,
      ...(trimmed === '' ? {} : { reference: trimmed }),
      ...(paidAtIso ? { paidAt: paidAtIso } : {}),
    });
    // On success the panel has already unmounted this dialog.
    if (!ok) setFailed(true);
  }

  const submitLabel = refund ? t('payments.dialog.refundSubmit') : t('payments.dialog.recordSubmit');
  return (
    <FormDialog
      open
      title={refund ? t('payments.dialog.refundTitle') : t('payments.dialog.recordTitle')}
      submitLabel={submitLabel}
      submitting={submitting}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      {refund ? <p className="text-sm text-slate-700">{t('payments.dialog.refundNotice')}</p> : null}
      <div className="flex flex-col gap-1">
        <label htmlFor="payment-method" className="text-sm font-medium text-slate-700">
          {t('payments.dialog.methodLabel')}
        </label>
        <select
          id="payment-method"
          name="payment-method"
          required
          value={method}
          onChange={(event) => setMethod(event.target.value as PaymentMethod)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          {METHODS.map((value) => (
            <option key={value} value={value}>
              {t(`payments.method.${value}`)}
            </option>
          ))}
        </select>
      </div>
      <FormField
        label={t('payments.dialog.amountLabel')}
        name="payment-amount"
        inputMode="decimal"
        autoComplete="off"
        required
        value={amount}
        error={amountError}
        onChange={(event) => setAmount(event.target.value)}
      />
      <FormField
        label={t('payments.dialog.referenceLabel')}
        name="payment-reference"
        autoComplete="off"
        maxLength={120}
        value={reference}
        onChange={(event) => setReference(event.target.value)}
      />
      <div className="flex flex-col gap-1">
        <FormField
          label={t('payments.dialog.paidAtLabel')}
          name="payment-paid-at"
          type="datetime-local"
          max={nowLocal}
          required
          value={paidAt}
          error={paidAtInvalid ? t('payments.error.paidAtFuture') : undefined}
          aria-describedby={paidAtInvalid ? 'payment-paid-at-error payment-paid-at-help' : 'payment-paid-at-help'}
          onChange={(event) => {
            setPaidAt(event.target.value);
            setPaidAtEdited(true);
            setPaidAtInvalid(false);
          }}
        />
        <p id="payment-paid-at-help" className="text-sm text-slate-600">
          {t('payments.dialog.paidAtHelp')}
        </p>
      </div>
      {failed && serverError ? (
        <p role="alert" className="text-sm text-red-600">
          {serverError}
        </p>
      ) : null}
    </FormDialog>
  );
}

// The ISO instant for an edited `datetime-local` value, or null when it is
// not a real Manila wall-clock time (e.g. 31 February) or is in the future.
function pastManilaInstant(value: string): string | null {
  const iso = manilaDateTimeLocalToIso(value);
  if (iso === null) return null;
  const time = Date.parse(iso);
  if (Number.isNaN(time) || toManilaDateTimeLocal(new Date(time)) !== value) return null;
  return time <= Date.now() ? iso : null;
}
