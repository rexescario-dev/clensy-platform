'use client';

import { useCurrentAdminQuery, useInvoiceForOrderQuery, useLaundryOrderQuery } from '@clensy/client';
import type { InvoiceForOrderQuery, LaundryOrderQuery } from '@clensy/client';
import { ErrorState, LoadingState, PageHeader, StatusBadge } from '@clensy/ui';
import {
  LAUNDRY_STATUS_TONE,
  LaundryOrderProgress,
  formatWeightGrams,
  laundryOrderActions,
  useClensyTranslations,
  type LaundryOrderVerb,
} from '@clensy/web';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { LaundryWeighingEditor } from '../../../../components/laundry/laundry-weighing-editor';
import { formatMinorUnits } from '../../../../lib/format-price';
import { isUuid } from '../../../../lib/laundry-order-list-query';
import {
  LAUNDRY_ORDER_SECTIONS,
  currentLaundryOrderSection,
  laundryLifecycleVerbs,
  laundryLineQuantity,
  laundryOrderSectionId,
  laundryWeighingView,
  resolvedInvoiceNodes,
  type LaundryOrderSection,
} from '../../../../lib/laundry-order-page';

type LaundryOrderDetail = NonNullable<LaundryOrderQuery['laundryOrder']>;
type Invoice = InvoiceForOrderQuery['invoices']['nodes'][number];
type Translate = (key: string) => string;

// The order workspace (lifecycle spec §8.4.4, #156). Weighing records a
// weight (#155). Services (#158), Price (#162), Invoice (#166) and
// Actions (#165) still show facts until their issues add controls. The
// list still opens the drawer until the cutover (#161).
export default function LaundryOrderPage() {
  const { id } = useParams<{ id: string }>();
  // A new key per order, so moving between orders starts fresh.
  return <LaundryOrderWorkspace key={id} id={id} />;
}

function LaundryOrderWorkspace({ id }: { id: string }) {
  const t = useClensyTranslations('laundry');
  // Postgres rejects an id that is not UUID-shaped, so it is never an
  // order: show not-found without a request.
  const validId = isUuid(id);
  const orderQuery = useLaundryOrderQuery({ fetchPolicy: 'network-only', skip: !validId, variables: { id } });
  const invoiceQuery = useInvoiceForOrderQuery({
    fetchPolicy: 'network-only',
    skip: !validId,
    variables: { laundryOrderId: id },
  });
  const { data: adminData } = useCurrentAdminQuery();
  const role = adminData?.currentAdmin.role;

  const backLink = (
    <div>
      <Link href="/app/laundry" className="text-sm text-slate-600 underline">
        {t('order.back')}
      </Link>
    </div>
  );

  // Loading wins over any data Apollo retains from an earlier result, and
  // an error wins over it below: the order is shown only from a finished,
  // successful query (M5 review 2).
  if (validId && orderQuery.loading) {
    return (
      <div className="flex flex-col gap-8">
        {backLink}
        <LoadingState />
      </div>
    );
  }

  const order = orderQuery.data?.laundryOrder;
  if (!validId || orderQuery.error || !order) {
    return (
      <div className="flex flex-col gap-8">
        {backLink}
        <ErrorState message={t('error.order')} />
      </div>
    );
  }

  // Only a finished, successful invoice result with its node list decides
  // the nav and the Invoice section. Data retained while it reloads or
  // after it fails (M5 review 1), and a result without the connection
  // (M5 review 3), leave both unresolved.
  const invoices = resolvedInvoiceNodes(invoiceQuery);
  const verbs = laundryOrderActions(order.status, order.fulfillmentType, role);
  const current = currentLaundryOrderSection({
    invoiceExists: invoices === undefined ? undefined : invoices.length > 0,
    status: order.status,
    verbs,
  });

  return (
    <div className="flex flex-col gap-8">
      {backLink}

      <PageHeader
        title={order.customer.fullName}
        description={order.id}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <StatusBadge label={t(`status.${order.status}`)} tone={LAUNDRY_STATUS_TONE[order.status]} />
            <span className="text-sm text-slate-600">{t(`fulfillment.${order.fulfillmentType}`)}</span>
          </div>
        }
      />

      <LaundryOrderProgress status={order.status} fulfillmentType={order.fulfillmentType} />

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryItem term={t('order.summary.customer')}>{order.customer.fullName}</SummaryItem>
        <SummaryItem term={t('order.summary.fulfillment')}>{t(`fulfillment.${order.fulfillmentType}`)}</SummaryItem>
        <SummaryItem term={t('order.summary.weight')}>
          {order.weightGrams === null ? '—' : formatWeightGrams(order.weightGrams)}
        </SummaryItem>
        <SummaryItem term={t('order.summary.total')}>
          {order.totalMinorUnits === null ? '—' : formatMinorUnits(order.totalMinorUnits)}
        </SummaryItem>
      </dl>

      <nav aria-label={t('order.sectionsLabel')}>
        <ul className="flex gap-3 overflow-x-auto">
          {LAUNDRY_ORDER_SECTIONS.map((section) => (
            <li key={section} className="shrink-0">
              <a
                href={`#${laundryOrderSectionId(section)}`}
                aria-current={section === current ? 'true' : undefined}
                className={`text-sm whitespace-nowrap ${section === current ? 'font-medium text-slate-900' : 'text-slate-600'}`}
              >
                {t(`order.sections.${section}`)}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <OrderSection section="overview" t={t}>
        <OverviewBody order={order} t={t} />
      </OrderSection>

      <OrderSection section="weighing" t={t}>
        <WeighingBody order={order} verbs={verbs} onRecorded={() => orderQuery.refetch()} t={t} />
      </OrderSection>

      <OrderSection section="services" t={t}>
        <p>{t(order.lines.nodes.length > 0 ? 'order.services.priced' : 'order.services.none')}</p>
      </OrderSection>

      <OrderSection section="price" t={t}>
        {order.totalMinorUnits === null ? (
          <p>{t('order.price.notPriced')}</p>
        ) : (
          <Fact term={t('order.price.total')}>{formatMinorUnits(order.totalMinorUnits)}</Fact>
        )}
      </OrderSection>

      <OrderSection section="invoice" t={t}>
        <InvoiceBody
          error={Boolean(invoiceQuery.error)}
          invoice={invoices?.[0]}
          resolved={invoices !== undefined}
          t={t}
        />
      </OrderSection>

      <OrderSection section="actions" t={t}>
        {role === undefined ? null : <ActionsBody verbs={laundryLifecycleVerbs(verbs)} t={t} />}
      </OrderSection>
    </div>
  );
}

function SummaryItem({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <dt className="text-sm text-slate-500">{term}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-900">{children}</dd>
    </div>
  );
}

function OrderSection({ section, t, children }: { section: LaundryOrderSection; t: Translate; children: ReactNode }) {
  return (
    <section id={laundryOrderSectionId(section)} className="scroll-mt-6">
      <h2 className="text-base font-semibold text-slate-900">{t(`order.sections.${section}`)}</h2>
      <div className="mt-3 text-sm text-slate-700">{children}</div>
    </section>
  );
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <dl className="flex flex-col gap-1">
      <dt className="text-slate-500">{term}</dt>
      <dd className="font-medium text-slate-900">{children}</dd>
    </dl>
  );
}

function OverviewBody({ order, t }: { order: LaundryOrderDetail; t: Translate }) {
  const { nodes, pageInfo } = order.lines;
  return (
    <div className="flex flex-col gap-3">
      {nodes.length === 0 ? (
        <p>{t('order.overview.noLines')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {nodes.map((line) => {
            const { amountMinorUnits, minimumChargeApplied, quantity, unit } = line.pricingSnapshot;
            const shown = laundryLineQuantity(unit, quantity);
            return (
              <li key={line.id} className="rounded-md border border-slate-200 p-3">
                <p className="font-medium text-slate-900">
                  {t(line.serviceId ? 'order.lines.service' : 'order.lines.addOn')}
                </p>
                <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div>
                    <dt className="text-slate-500">{t('order.lines.unit')}</dt>
                    <dd>{t(`order.unit.${unit}`)}</dd>
                  </div>
                  {shown ? (
                    <div>
                      <dt className="text-slate-500">{t(`order.lines.${shown.kind}`)}</dt>
                      <dd>{shown.value}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-slate-500">{t('order.lines.amount')}</dt>
                    <dd>{formatMinorUnits(amountMinorUnits)}</dd>
                  </div>
                </dl>
                {minimumChargeApplied ? <p className="mt-2 text-slate-600">{t('order.lines.minimumCharge')}</p> : null}
              </li>
            );
          })}
        </ul>
      )}
      {pageInfo.hasNextPage === true ? <p className="text-slate-600">{t('order.lines.more')}</p> : null}
    </div>
  );
}

// #155, owner decision 1 (M4): the editor for an actor who may weigh; the
// locked sentence, with the weight, for a priced order; otherwise the
// recorded weight or "Not weighed yet.". The recorded line is the server
// value, so it changes only after a save's refetch.
function WeighingBody({
  onRecorded,
  order,
  t,
  verbs,
}: {
  onRecorded: () => Promise<unknown>;
  order: LaundryOrderDetail;
  t: Translate;
  verbs: readonly LaundryOrderVerb[];
}) {
  const view = laundryWeighingView(order.status, verbs);
  const recorded =
    order.weightGrams === null ? null : (
      <Fact term={t('order.weighing.recorded')}>{formatWeightGrams(order.weightGrams)}</Fact>
    );
  if (view === 'readOnly') return recorded ?? <p>{t('order.weighing.notWeighed')}</p>;
  if (view === 'locked') {
    return (
      <div className="flex flex-col gap-3">
        <p>{t('order.weighing.locked')}</p>
        {recorded}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {recorded}
      <LaundryWeighingEditor onRecorded={onRecorded} orderId={order.id} weightGrams={order.weightGrams} />
    </div>
  );
}

function InvoiceBody({
  error,
  invoice,
  resolved,
  t,
}: {
  error: boolean;
  invoice: Invoice | undefined;
  // `resolvedInvoiceNodes` returned a node list: finished, no error,
  // connection present.
  resolved: boolean;
  t: Translate;
}) {
  if (error) return <p className="text-red-600">{t('order.invoice.error')}</p>;
  if (!resolved) return null;
  if (!invoice) return <p>{t('order.invoice.none')}</p>;
  return (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <div>
        <dt className="text-slate-500">{t('order.invoice.number')}</dt>
        <dd className="font-medium text-slate-900">{invoice.invoiceNumber}</dd>
      </div>
      <div>
        <dt className="text-slate-500">{t('order.invoice.total')}</dt>
        <dd className="font-medium text-slate-900">{formatMinorUnits(invoice.totalMinorUnits)}</dd>
      </div>
      <div>
        <dt className="text-slate-500">{t('order.invoice.paymentStatus')}</dt>
        <dd className="font-medium text-slate-900">{t(`invoicePaymentStatus.${invoice.paymentStatus}`)}</dd>
      </div>
    </dl>
  );
}

// Names what the actor may do next, as text. The server re-checks every
// verb; this page offers no control (#156 §Role and lifecycle).
function ActionsBody({ verbs, t }: { verbs: LaundryOrderVerb[]; t: Translate }) {
  if (verbs.length === 0) return <p>{t('noActions')}</p>;
  return (
    <>
      <p>{t('order.actions.available')}</p>
      <ul className="mt-2 list-disc pl-5">
        {verbs.map((verb) => (
          <li key={verb}>{t(`actions.${verb}`)}</li>
        ))}
      </ul>
    </>
  );
}
