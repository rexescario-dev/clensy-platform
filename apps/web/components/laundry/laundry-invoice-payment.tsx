'use client';

import type { InvoiceForOrderQuery, InvoicePaymentTerms, Role } from '@clensy/client';
import { Button, LoadingState } from '@clensy/ui';
import { useClensyTranslations } from '@clensy/web';
import Link from 'next/link';
import { useId, useState, type ReactNode } from 'react';
import type { LaundryInvoiceView, LaundryPaymentVerb, LaundryPaymentView } from '../../lib/laundry-invoice-payment';
import type { LaundryMutationLock } from '../../lib/use-laundry-mutation-lock';
import { InvoicePaymentsPanel } from '../billing/invoice-payments-panel';

type Invoice = InvoiceForOrderQuery['invoices']['nodes'][number];
type Translate = (key: string) => string;

// Terms are chosen once, at generation, and never edited (invoices spec
// §4.4). The default matches the drawer (#166).
const PAYMENT_TERMS: readonly InvoicePaymentTerms[] = ['PAY_NOW', 'PAY_ON_COMPLETION', 'PAY_ON_DELIVERY'];
const DEFAULT_TERMS: InvoicePaymentTerms = 'PAY_ON_COMPLETION';

export interface LaundryInvoiceCardProps {
  // Another mutation on the order page holds the page lock (#165): Generate
  // and the terms are disabled, without the "Generating…" label.
  disabled?: boolean;
  failed: boolean;
  generating: boolean;
  // Set when `view` is `invoice`.
  invoice: Invoice | undefined;
  // The page's shared lock (#39 decision i): the payments panel's writes
  // take it, and its controls are disabled while another mutation holds it.
  lock?: LaundryMutationLock;
  onGenerate: (paymentTerms: InvoicePaymentTerms) => void;
  // Runs after a payment write, so the page refetches `InvoiceForOrder`.
  onPaymentsChanged?: () => Promise<unknown>;
  // The viewer's role and `currentAdmin.id`, for the payments panel.
  role: Role | undefined;
  view: LaundryInvoiceView;
  viewerId: string | undefined;
}

export interface LaundryOrderPaymentCardProps {
  // Already filtered by the page with `laundryPaymentFailureAlert`
  // (#166 decision k), so it is shown in every view.
  failure: LaundryPaymentVerb | null;
  onRun: (verb: LaundryPaymentVerb) => void;
  pending: boolean;
  view: LaundryPaymentView;
}

// The Invoice card (#166): generate with chosen terms, or the existing
// invoice's facts, a link to the billing drawer, and the invoice payments
// panel (#39), which shows the amounts and status.
export function LaundryInvoiceCard(props: LaundryInvoiceCardProps) {
  const t = useClensyTranslations('laundry');
  return (
    <Card title={t('order.invoice.title')}>
      <InvoiceBody {...props} t={t} />
    </Card>
  );
}

// The Order payment card (#166): the next order-level payment verb. Marking
// the order paid or awaiting payment changes its status only; it is not the
// invoice's payment status (lifecycle spec §8.4.4).
export function LaundryOrderPaymentCard({ failure, onRun, pending, view }: LaundryOrderPaymentCardProps) {
  const t = useClensyTranslations('laundry');
  return (
    <Card title={t('order.payment.title')}>
      <p className="mt-2 text-slate-600">{t('order.payment.explanation')}</p>
      {view === 'paid' ? <p className="mt-3">{t('order.payment.paid')}</p> : null}
      {view === 'choose' ? <p className="mt-3">{t('order.payment.choose')}</p> : null}
      {view === 'choose' || view === 'markPaid' ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" disabled={pending} onClick={() => onRun('markPaid')}>
            {t('actions.markPaid')}
          </Button>
          {view === 'choose' ? (
            <Button type="button" variant="secondary" disabled={pending} onClick={() => onRun('markAwaitingPayment')}>
              {t('actions.markAwaitingPayment')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {failure ? (
        <p role="alert" className="mt-3 text-red-600">
          {t(`failure.${failure}`)}
        </p>
      ) : null}
    </Card>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </div>
  );
}

function GenerateForm({
  disabled,
  failed,
  generating,
  onGenerate,
  t,
}: {
  disabled: boolean;
  failed: boolean;
  generating: boolean;
  onGenerate: (paymentTerms: InvoicePaymentTerms) => void;
  t: Translate;
}) {
  const [terms, setTerms] = useState<InvoicePaymentTerms>(DEFAULT_TERMS);
  // Per instance, so two mounted forms never share an id or a radio group.
  const prefix = useId();
  return (
    <div className="mt-3 flex flex-col gap-3">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-slate-700">{t('order.invoice.terms')}</legend>
        {PAYMENT_TERMS.map((option) => {
          const id = `${prefix}-terms-${option}`;
          return (
            <div key={option} className="flex items-start gap-2">
              <input
                id={id}
                type="radio"
                name={`${prefix}-terms`}
                value={option}
                checked={terms === option}
                disabled={generating || disabled}
                aria-describedby={`${id}-help`}
                className="mt-1 focus:ring-2 focus:ring-slate-400"
                onChange={() => setTerms(option)}
              />
              <div>
                <label htmlFor={id} className="font-medium text-slate-900">
                  {t(`paymentTerms.${option}`)}
                </label>
                <p id={`${id}-help`} className="text-slate-600">
                  {t(`order.invoice.termsHelp.${option}`)}
                </p>
              </div>
            </div>
          );
        })}
      </fieldset>
      <div>
        <Button type="button" disabled={generating || disabled} onClick={() => onGenerate(terms)}>
          {t(generating ? 'order.invoice.generating' : 'actions.generateInvoice')}
        </Button>
      </div>
      {failed ? (
        <p role="alert" className="text-red-600">
          {t('failure.generateInvoice')}
        </p>
      ) : null}
    </div>
  );
}

function InvoiceBody({
  disabled = false,
  failed,
  generating,
  invoice,
  lock,
  onGenerate,
  onPaymentsChanged,
  role,
  t,
  view,
  viewerId,
}: LaundryInvoiceCardProps & { t: Translate }) {
  switch (view) {
    case 'error':
      return <p className="mt-3 text-red-600">{t('order.invoice.error')}</p>;
    case 'generate':
      return <GenerateForm disabled={disabled} failed={failed} generating={generating} t={t} onGenerate={onGenerate} />;
    case 'invoice':
      return invoice ? (
        <div className="mt-3 flex flex-col gap-4">
          <InvoiceFacts invoice={invoice} t={t} />
          <InvoicePaymentsPanel
            invoiceId={invoice.id}
            lock={lock}
            role={role}
            viewerId={viewerId}
            onChanged={onPaymentsChanged}
          />
        </div>
      ) : null;
    case 'loading':
      return (
        <div className="mt-3">
          <LoadingState />
        </div>
      );
    case 'none':
      return <p className="mt-3">{t('order.invoice.none')}</p>;
    case 'unresolved':
      return null;
  }
}

// The invoice's number and terms and the billing link (#166). The total and
// status are shown by the payments panel below (#39 planning decision o).
function InvoiceFacts({ invoice, t }: { invoice: Invoice; t: Translate }) {
  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">{t('order.invoice.number')}</dt>
          <dd className="font-medium text-slate-900">{invoice.invoiceNumber}</dd>
        </div>
        <div>
          <dt className="text-slate-500">{t('order.invoice.terms')}</dt>
          <dd className="font-medium text-slate-900">{t(`paymentTerms.${invoice.paymentTerms}`)}</dd>
        </div>
      </dl>
      <Link href={`/app/billing?detail=${encodeURIComponent(invoice.id)}`} className="text-slate-900 underline">
        {t('order.invoice.open')}
      </Link>
    </div>
  );
}
