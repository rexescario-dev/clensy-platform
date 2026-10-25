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
import { useState, type ReactNode } from 'react';
import { LaundryInvoiceCard, LaundryOrderPaymentCard } from '../../../../components/laundry/laundry-invoice-payment';
import { LaundryOrderActions } from '../../../../components/laundry/laundry-order-actions';
import { LaundryServicesEditor } from '../../../../components/laundry/laundry-services-editor';
import { LaundryPriceCard } from '../../../../components/laundry/laundry-price-card';
import { LaundryWeighingEditor } from '../../../../components/laundry/laundry-weighing-editor';
import { formatMinorUnits } from '../../../../lib/format-price';
import { laundryInvoiceView, laundryPaymentFailureAlert, laundryPaymentView } from '../../../../lib/laundry-invoice-payment';
import { isUuid } from '../../../../lib/laundry-order-list-query';
import {
  isLaundryPaymentVerb,
  laundryActionFailure,
  laundryActionGroups,
  type LaundryActionVerb,
} from '../../../../lib/laundry-order-lifecycle-actions';
import {
  LAUNDRY_ORDER_SECTIONS,
  currentLaundryOrderSection,
  formatLaundryOrderTime,
  laundryOrderSectionId,
  laundryWeighingView,
  resolvedInvoiceNodes,
  type LaundryOrderSection,
} from '../../../../lib/laundry-order-page';
import {
  laundryEstimateState,
  laundryPreviewRows,
  laundryPriceView,
  laundrySnapshotRows,
  type LaundryPriceView,
} from '../../../../lib/laundry-price-review';
import { laundryServicesView, type LaundryServicesView } from '../../../../lib/laundry-service-selection';
import {
  useLaundryServiceSelection,
  type LaundryServiceSelectionState,
} from '../../../../lib/use-laundry-service-selection';
import { useConfirmLaundryPrice, type ConfirmLaundryPriceState } from '../../../../lib/use-confirm-laundry-price';
import { useGenerateLaundryInvoice, type GenerateLaundryInvoiceState } from '../../../../lib/use-generate-laundry-invoice';
import { useLaundryMutationLock, type LaundryMutationLock } from '../../../../lib/use-laundry-mutation-lock';
import { useLaundryOrderTransition, type LaundryOrderTransitionState } from '../../../../lib/use-laundry-order-transition';

type LaundryOrderDetail = NonNullable<LaundryOrderQuery['laundryOrder']>;
type Invoice = InvoiceForOrderQuery['invoices']['nodes'][number];
type Translate = (key: string) => string;

// The order workspace (lifecycle spec §8.4.4, #156). Weighing records a
// weight (#155). Services chooses the base service and add-ons (#158).
// Price shows the estimate and confirms it, or the final price (#162).
// Invoice and payment generates the invoice and runs the two payment verbs
// (#166). Actions offers the remaining lifecycle verbs as buttons, with a
// confirmation for the destructive ones, and Activity shows when the order
// was created and last changed (#165). The list still opens the drawer
// until the cutover (#161).
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
  // The page's one mutation lock (#165, U5). Every mutation owner below
  // takes it before it starts, so two mutations never overlap; it lives in
  // this workspace, which is keyed by order id, so each order has its own.
  const lock = useLaundryMutationLock();
  // Lives here, above Weighing and Price, so both editors are disabled
  // while a price is confirmed and its refetch runs (#162 owner decision 6.3).
  const confirmPrice = useConfirmLaundryPrice({ lock, refetch: () => orderQuery.refetch() });
  // The page's one in-flight guard for lifecycle verbs (#166): the payment
  // card and the Actions buttons and confirm dialog share it (#165).
  const transition = useLaundryOrderTransition({ lock, orderId: id, refetch: () => orderQuery.refetch() });
  const generateInvoice = useGenerateLaundryInvoice({ lock, orderId: id, refetch: () => invoiceQuery.refetch() });
  // The destructive verb whose confirmation is open, and the one whose
  // confirmation has been submitted. The dialog's `confirming` is only its
  // own submission, so an unrelated mutation never makes an unsubmitted
  // dialog impossible to cancel (#165 rule 6).
  const [confirmVerb, setConfirmVerb] = useState<LaundryActionVerb | null>(null);
  const [submittingVerb, setSubmittingVerb] = useState<LaundryActionVerb | null>(null);
  // A weight being saved and reloaded makes the estimate stale before the
  // order shows the new weight, so Price holds Confirm until both settle
  // (#162 M7 follow-up).
  const [weighing, setWeighing] = useState(false);

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
        <WeighingBody
          disabled={lock.held}
          lock={lock}
          order={order}
          verbs={verbs}
          onPendingChange={setWeighing}
          onRecorded={() => orderQuery.refetch()}
          t={t}
        />
      </OrderSection>

      <PricingSections
        confirmPrice={confirmPrice}
        locked={lock.held}
        order={order}
        roleResolved={role !== undefined}
        verbs={verbs}
        weighing={weighing}
        t={t}
      />

      <OrderSection section="invoice" t={t}>
        <InvoicePaymentBody
          busy={lock.held}
          generateInvoice={generateInvoice}
          invoiceError={Boolean(invoiceQuery.error)}
          invoiceLoading={invoiceQuery.loading}
          invoices={invoices}
          order={order}
          transition={transition}
          verbs={verbs}
        />
      </OrderSection>

      <OrderSection section="actions" t={t}>
        {role === undefined ? null : (
          <LaundryOrderActions
            verbs={verbs}
            disabled={lock.held}
            failure={laundryActionFailure(transition.failure, transition.message)}
            // A refetch that removes the verb hides its dialog.
            confirmVerb={confirmVerb !== null && laundryActionGroups(verbs).destructive.includes(confirmVerb) ? confirmVerb : null}
            confirming={submittingVerb !== null}
            onRun={(verb) => void transition.run(verb)}
            onRequestConfirm={(verb) => {
              if (!lock.isHeld()) setConfirmVerb(verb);
            }}
            onConfirm={async (verb) => {
              // Refused while another mutation holds the lock: the dialog
              // stays open and cancellable, and nothing is sent.
              if (lock.isHeld()) return;
              setSubmittingVerb(verb);
              try {
                await transition.run(verb);
              } finally {
                setSubmittingVerb(null);
                setConfirmVerb(null);
              }
            }}
            onCloseConfirm={() => setConfirmVerb(null)}
          />
        )}
      </OrderSection>

      <OrderSection section="activity" t={t}>
        <ActivityBody order={order} t={t} />
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

// Before pricing, the existing sentence; afterwards one line that points
// at Price, which owns the line list (#162 owner decision 1). The count is
// the saved lines, never the selection or the preview. A partial page has
// no reliable count (planning decision g).
function OverviewBody({ order, t }: { order: LaundryOrderDetail; t: Translate }) {
  const { nodes, pageInfo } = order.lines;
  if (nodes.length === 0) return <p>{t('order.overview.noLines')}</p>;
  const summary =
    pageInfo.hasNextPage === true
      ? t('order.overview.pricedPartial')
      : nodes.length === 1
        ? t('order.overview.pricedOne')
        : t('order.overview.priced').replace('{n}', String(nodes.length));
  return (
    <p>
      {summary}{' '}
      <a href={`#${laundryOrderSectionId('price')}`} className="underline">
        {t('order.overview.seePrice')}
      </a>
    </p>
  );
}

// #155, owner decision 1 (M4): the editor for an actor who may weigh; the
// locked sentence, with the weight, for a priced order; otherwise the
// recorded weight or "Not weighed yet.". The recorded line is the server
// value, so it changes only after a save's refetch.
function WeighingBody({
  disabled,
  lock,
  onPendingChange,
  onRecorded,
  order,
  t,
  verbs,
}: {
  disabled: boolean;
  lock: LaundryMutationLock;
  onPendingChange: (pending: boolean) => void;
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
      <LaundryWeighingEditor
        disabled={disabled}
        lock={lock}
        onPendingChange={onPendingChange}
        onRecorded={onRecorded}
        orderId={order.id}
        weightGrams={order.weightGrams}
      />
    </div>
  );
}

// Services and Price share the selection and its current preview (#158).
// The state lives here, above both sections, so Price reads it instead of
// starting a second preview (#162). The workspace is keyed by order id, so
// another order starts with an empty selection.
function PricingSections({
  confirmPrice,
  locked,
  order,
  roleResolved,
  t,
  verbs,
  weighing,
}: {
  confirmPrice: ConfirmLaundryPriceState;
  // The page lock is held by any mutation (#165).
  locked: boolean;
  order: LaundryOrderDetail;
  roleResolved: boolean;
  t: Translate;
  verbs: readonly LaundryOrderVerb[];
  weighing: boolean;
}) {
  const view = laundryServicesView({
    hasTotal: order.totalMinorUnits !== null,
    roleResolved,
    status: order.status,
    verbs,
  });
  const selection = useLaundryServiceSelection({
    enabled: view === 'editor',
    orderId: order.id,
    weightGrams: order.weightGrams,
  });
  const priceView = laundryPriceView({
    hasTotal: order.totalMinorUnits !== null,
    roleResolved,
    status: order.status,
    verbs,
  });
  return (
    <>
      <OrderSection section="services" t={t}>
        <ServicesBody disabled={confirmPrice.confirming} selection={selection} t={t} view={view} />
      </OrderSection>

      <OrderSection section="price" t={t}>
        <PriceBody
          confirmPrice={confirmPrice}
          locked={locked}
          order={order}
          selection={selection}
          t={t}
          view={priceView}
          weighing={weighing}
        />
      </OrderSection>
    </>
  );
}

// Owner decision 4 (#158). Price lists a priced order's lines (#162 owner
// decision 1). `locked` is keyed on the persisted total, the same signal as
// Price's Final card, so the two sections never disagree (#162 planning
// decision a).
function ServicesBody({
  disabled,
  selection,
  t,
  view,
}: {
  disabled: boolean;
  selection: LaundryServiceSelectionState;
  t: Translate;
  view: LaundryServicesView;
}) {
  switch (view) {
    case 'hidden':
      return null;
    case 'editor':
      return <LaundryServicesEditor disabled={disabled} state={selection} />;
    case 'beforeWeigh':
      return <p>{t('order.services.beforeWeigh')}</p>;
    case 'none':
      return <p>{t('order.services.none')}</p>;
    case 'locked':
      return <p>{t('order.services.locked')}</p>;
  }
}

// #162 owner decision 5. A final price comes from the frozen snapshot
// (§8.4.2, §8.4.4) and never calls the preview. An estimate comes from the
// current preview only, and Confirm sends that preview's input unchanged
// (owner decision 6.1).
function PriceBody({
  confirmPrice,
  locked,
  order,
  selection,
  t,
  view,
  weighing,
}: {
  confirmPrice: ConfirmLaundryPriceState;
  // The page lock is held by any mutation (#165): Confirm is disabled.
  locked: boolean;
  order: LaundryOrderDetail;
  selection: LaundryServiceSelectionState;
  t: Translate;
  view: LaundryPriceView;
  // A weight save and its reload are in flight: the estimate is stale.
  weighing: boolean;
}) {
  if (view === 'final' && order.totalMinorUnits !== null) {
    return (
      <LaundryPriceCard
        kind="final"
        more={order.lines.pageInfo.hasNextPage === true}
        rows={laundrySnapshotRows(order.lines.nodes)}
        totalMinorUnits={order.totalMinorUnits}
      />
    );
  }
  if (view === 'beforePricing') return <p>{t('order.price.beforePricing')}</p>;
  if (view === 'notPriced') return <p>{t('order.price.notPriced')}</p>;
  if (view !== 'estimate') return null;
  const { preview, priceInput } = selection;
  // A weight being saved counts as a loading preview (owner decision 3).
  const ready = selection.ready && !weighing;
  // Only for the selection Confirm used: any edit replaces the object
  // (planning decision e).
  const failure = confirmPrice.failure?.selection === selection.selection ? confirmPrice.failure.message : undefined;
  return (
    <LaundryPriceCard
      kind="estimate"
      confirming={confirmPrice.confirming}
      disabled={locked}
      failure={failure}
      rows={preview ? laundryPreviewRows(preview.lines) : []}
      state={laundryEstimateState({
        complete: selection.complete,
        hasBase: selection.selection.base !== null,
        previewError: selection.previewError !== null,
        previewLoading: selection.previewLoading || weighing,
        ready,
      })}
      totalMinorUnits={preview?.estimatedTotalMinorUnits ?? null}
      onConfirm={() => {
        if (ready && priceInput) void confirmPrice.confirm(priceInput, selection.selection);
      }}
      onRetry={selection.retryPreview}
    />
  );
}

// #166: generating an invoice and the order's payment verbs, side by side
// and kept separate. Marking the order paid changes its status only; the
// invoice's payment status is #39's (lifecycle spec §8.4.4).
function InvoicePaymentBody({
  busy,
  generateInvoice,
  invoiceError,
  invoiceLoading,
  invoices,
  order,
  transition,
  verbs,
}: {
  // The page lock is held by any mutation (#165): every control here is
  // disabled.
  busy: boolean;
  generateInvoice: GenerateLaundryInvoiceState;
  invoiceError: boolean;
  invoiceLoading: boolean;
  // `resolvedInvoiceNodes`: a node list only from a finished, error-free
  // result that carries the connection.
  invoices: readonly Invoice[] | undefined;
  order: LaundryOrderDetail;
  transition: LaundryOrderTransitionState;
  verbs: readonly LaundryOrderVerb[];
}) {
  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:gap-4">
      <LaundryInvoiceCard
        disabled={busy}
        failed={generateInvoice.failed}
        generating={generateInvoice.generating}
        invoice={invoices?.[0]}
        view={laundryInvoiceView({ error: invoiceError, invoices, loading: invoiceLoading, verbs })}
        onGenerate={(paymentTerms) => void generateInvoice.generate(paymentTerms)}
      />
      <LaundryOrderPaymentCard
        // `order.status` is read from the order query on every render. The
        // transition hook keeps `pending` until its refetch settles; once
        // Apollo has applied that refetch, this is the reloaded status, and a
        // failure is hidden only when it is the attempted outcome (decision
        // k). That Apollo applies a refetch to the query, or sets `error`
        // when it fails, is relied on, not tested: the page tests set the
        // query state themselves.
        failure={laundryPaymentFailureAlert(
          isLaundryPaymentVerb(transition.failure) ? transition.failure : null,
          order.status,
        )}
        pending={busy}
        view={laundryPaymentView(order.status, verbs)}
        onRun={(verb) => void transition.run(verb)}
      />
    </div>
  );
}

// When the order was created and last changed, and its status (#165). It is
// not an event log: no audit history is read (ticket "There is no
// order-history API"), so the section is "Activity", not "History".
function ActivityBody({ order, t }: { order: LaundryOrderDetail; t: Translate }) {
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <ActivityItem term={t('order.activity.created')}>{formatLaundryOrderTime(order.createdAt)}</ActivityItem>
      <ActivityItem term={t('order.activity.updated')}>{formatLaundryOrderTime(order.updatedAt)}</ActivityItem>
      <ActivityItem term={t('order.activity.status')}>
        <StatusBadge label={t(`status.${order.status}`)} tone={LAUNDRY_STATUS_TONE[order.status]} />
      </ActivityItem>
    </dl>
  );
}

function ActivityItem({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-slate-500">{term}</dt>
      <dd className="font-medium text-slate-900">{children}</dd>
    </div>
  );
}
