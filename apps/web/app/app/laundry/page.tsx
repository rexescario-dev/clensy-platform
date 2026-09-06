'use client';

import {
  useCancelLaundryOrderMutation,
  useCompleteLaundryOrderMutation,
  useCustomersQuery,
  useLaundryOrderQuery,
  useLaundryOrdersQuery,
  useMarkLaundryOrderAwaitingDeliveryMutation,
  useMarkLaundryOrderAwaitingPaymentMutation,
  useMarkLaundryOrderAwaitingPickupMutation,
  useMarkLaundryOrderDamagedMutation,
  useMarkLaundryOrderLostMutation,
  useMarkLaundryOrderPaidMutation,
  useMarkLaundryOrderReadyMutation,
  usePriceLaundryOrderMutation,
  useReceiveLaundryOrderMutation,
  useRefundLaundryOrderMutation,
  useRejectLaundryOrderMutation,
  useServicesQuery,
  useStartLaundryProcessingMutation,
  useWeighLaundryOrderMutation,
} from '@clensy/client';
import type {
  LaundryFulfillmentType,
  LaundryOrderStatus,
} from '@clensy/client';
import {
  Button,
  ConfirmDialog,
  DataTable,
  DetailDrawer,
  ErrorState,
  FormDialog,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '@clensy/ui';
import type { DataTableColumn, StatusTone } from '@clensy/ui';
import { Suspense, useState } from 'react';
import { formatMinorUnits } from '../../../lib/format-price';
import { useDetailDrawer } from '../../../lib/use-detail-drawer';

type OrderRow = {
  id: string;
  status: LaundryOrderStatus;
  fulfillmentType: LaundryFulfillmentType;
  weightGrams: number | null;
  totalMinorUnits: number | null;
  createdAt: unknown;
  customer: { id: string; fullName: string };
  [key: string]: unknown;
};

const STATUS_TONE: Record<LaundryOrderStatus, StatusTone> = {
  RECEIVED: 'neutral',
  WEIGHED: 'neutral',
  PRICED: 'neutral',
  AWAITING_PAYMENT: 'neutral',
  PAID: 'warning',
  PROCESSING: 'warning',
  READY: 'warning',
  AWAITING_PICKUP: 'warning',
  AWAITING_DELIVERY: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  REJECTED: 'danger',
  LOST: 'danger',
  DAMAGED: 'danger',
  REFUNDED: 'danger',
};

// Client mirror of the spec §4.3 transition matrix, for presentation only.
// The server re-checks every transition (spec §4.9).
const MATRIX: Record<LaundryOrderStatus, LaundryOrderStatus[]> = {
  RECEIVED: ['WEIGHED', 'REJECTED', 'CANCELLED'],
  WEIGHED: ['PRICED', 'REJECTED', 'CANCELLED'],
  PRICED: ['AWAITING_PAYMENT', 'PAID', 'CANCELLED'],
  AWAITING_PAYMENT: ['PAID', 'CANCELLED'],
  PAID: ['PROCESSING', 'REFUNDED'],
  PROCESSING: ['READY', 'LOST', 'DAMAGED', 'REFUNDED'],
  READY: ['AWAITING_PICKUP', 'AWAITING_DELIVERY', 'LOST', 'DAMAGED', 'REFUNDED'],
  AWAITING_PICKUP: ['COMPLETED', 'LOST', 'DAMAGED', 'REFUNDED'],
  AWAITING_DELIVERY: ['COMPLETED', 'LOST', 'DAMAGED', 'REFUNDED'],
  COMPLETED: ['REFUNDED'],
  LOST: ['REFUNDED'],
  DAMAGED: ['REFUNDED'],
  CANCELLED: [],
  REJECTED: [],
  REFUNDED: [],
};

type RefVerb =
  | 'markAwaitingPayment'
  | 'markPaid'
  | 'startProcessing'
  | 'markReady'
  | 'markAwaitingPickup'
  | 'markAwaitingDelivery'
  | 'complete'
  | 'cancel'
  | 'reject'
  | 'markLost'
  | 'markDamaged'
  | 'refund';

const TARGET_TO_VERB: Partial<Record<LaundryOrderStatus, RefVerb>> = {
  AWAITING_PAYMENT: 'markAwaitingPayment',
  PAID: 'markPaid',
  PROCESSING: 'startProcessing',
  READY: 'markReady',
  AWAITING_PICKUP: 'markAwaitingPickup',
  AWAITING_DELIVERY: 'markAwaitingDelivery',
  COMPLETED: 'complete',
  CANCELLED: 'cancel',
  REJECTED: 'reject',
  LOST: 'markLost',
  DAMAGED: 'markDamaged',
  REFUNDED: 'refund',
};

const DESTRUCTIVE: ReadonlySet<RefVerb> = new Set([
  'cancel',
  'reject',
  'markLost',
  'markDamaged',
  'refund',
]);

const VERB_LABEL: Record<RefVerb, string> = {
  markAwaitingPayment: 'Mark awaiting payment',
  markPaid: 'Mark paid',
  startProcessing: 'Start processing',
  markReady: 'Mark ready',
  markAwaitingPickup: 'Mark awaiting pickup',
  markAwaitingDelivery: 'Mark awaiting delivery',
  complete: 'Complete order',
  cancel: 'Cancel order',
  reject: 'Reject order',
  markLost: 'Mark lost',
  markDamaged: 'Mark damaged',
  refund: 'Refund order',
};

function formatDate(value: unknown): string {
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

function formatWeight(grams: number | null): string {
  return grams === null ? '—' : `${(grams / 1000).toFixed(2)} kg`;
}

export default function LaundryPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <LaundryPageContent />
    </Suspense>
  );
}

function LaundryPageContent() {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const ordersQuery = useLaundryOrdersQuery({
    fetchPolicy: 'network-only',
    variables: { paging: { limit: pageSize, offset: (page - 1) * pageSize } },
  });
  const { data: customersData } = useCustomersQuery({
    fetchPolicy: 'network-only',
    variables: { paging: { limit: 100 } },
  });
  const [receive, { loading: creating }] = useReceiveLaundryOrderMutation();
  const { activeId, open: openDetail, close: closeDetail } = useDetailDrawer();

  const [formOpen, setFormOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [fulfillmentType, setFulfillmentType] =
    useState<LaundryFulfillmentType>('PICKUP');
  const [formError, setFormError] = useState<string | undefined>(undefined);

  function openCreateForm() {
    setCustomerId('');
    setFulfillmentType('PICKUP');
    setFormError(undefined);
    setFormOpen(true);
  }

  async function handleCreate() {
    setFormError(undefined);
    try {
      const result = await receive({
        variables: { input: { customerId, fulfillmentType } },
      });
      setFormOpen(false);
      await ordersQuery.refetch();
      const newId = result.data?.receiveLaundryOrder.id;
      if (newId) openDetail(newId);
    } catch {
      setFormError('Unable to create laundry order.');
    }
  }

  const columns: DataTableColumn<OrderRow>[] = [
    { key: 'customer', header: 'Customer', render: (r) => r.customer.fullName },
    { key: 'fulfillment', header: 'Fulfillment', render: (r) => r.fulfillmentType },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <StatusBadge label={r.status} tone={STATUS_TONE[r.status]} />
      ),
    },
    { key: 'weight', header: 'Weight', render: (r) => formatWeight(r.weightGrams) },
    {
      key: 'total',
      header: 'Total',
      render: (r) =>
        r.totalMinorUnits === null ? '—' : formatMinorUnits(r.totalMinorUnits),
    },
    { key: 'created', header: 'Created', render: (r) => formatDate(r.createdAt) },
  ];

  const rows = (ordersQuery.data?.laundryOrders.nodes ?? []) as OrderRow[];
  const customers = customersData?.customers.nodes ?? [];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Laundry"
        actions={
          <Button type="button" onClick={openCreateForm}>
            + New Laundry Order
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        emptyMessage="No laundry orders."
        loading={ordersQuery.loading}
        error={ordersQuery.error ? 'Unable to load laundry orders.' : undefined}
        onRowClick={(r) => openDetail(r.id)}
        pagination={{
          page,
          pageSize,
          totalCount: ordersQuery.data?.laundryOrders.totalCount ?? 0,
          onPageChange: setPage,
        }}
      />

      <FormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="New laundry order"
        onSubmit={handleCreate}
        submitLabel={creating ? 'Creating…' : 'Create order'}
        submitting={creating}
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="laundry-customer" className="text-sm font-medium text-slate-700">
            Customer
          </label>
          <select
            id="laundry-customer"
            required
            value={customerId}
            onChange={(e) => setCustomerId(e.currentTarget.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <option value="">Select a customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="laundry-fulfillment" className="text-sm font-medium text-slate-700">
            Fulfillment
          </label>
          <select
            id="laundry-fulfillment"
            value={fulfillmentType}
            onChange={(e) =>
              setFulfillmentType(e.currentTarget.value as LaundryFulfillmentType)
            }
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <option value="PICKUP">Customer pickup</option>
            <option value="DELIVERY">Delivery</option>
          </select>
        </div>
        {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
      </FormDialog>

      {activeId ? (
        <LaundryDetailDrawer
          id={activeId}
          onClose={closeDetail}
          onChanged={() => void ordersQuery.refetch()}
        />
      ) : null}
    </div>
  );
}

function LaundryDetailDrawer({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data, loading, error, refetch } = useLaundryOrderQuery({
    variables: { id },
    fetchPolicy: 'network-only',
  });
  const { data: servicesData } = useServicesQuery({
    fetchPolicy: 'network-only',
    variables: { paging: { limit: 100 } },
  });

  const [weigh] = useWeighLaundryOrderMutation();
  const [price] = usePriceLaundryOrderMutation();
  const [markAwaitingPayment] = useMarkLaundryOrderAwaitingPaymentMutation();
  const [markPaid] = useMarkLaundryOrderPaidMutation();
  const [startProcessing] = useStartLaundryProcessingMutation();
  const [markReady] = useMarkLaundryOrderReadyMutation();
  const [markAwaitingPickup] = useMarkLaundryOrderAwaitingPickupMutation();
  const [markAwaitingDelivery] = useMarkLaundryOrderAwaitingDeliveryMutation();
  const [complete] = useCompleteLaundryOrderMutation();
  const [cancel] = useCancelLaundryOrderMutation();
  const [reject] = useRejectLaundryOrderMutation();
  const [markLost] = useMarkLaundryOrderLostMutation();
  const [markDamaged] = useMarkLaundryOrderDamagedMutation();
  const [refund] = useRefundLaundryOrderMutation();

  const refRunners: Record<RefVerb, (orderId: string) => Promise<unknown>> = {
    markAwaitingPayment: (orderId) =>
      markAwaitingPayment({ variables: { input: { orderId } } }),
    markPaid: (orderId) => markPaid({ variables: { input: { orderId } } }),
    startProcessing: (orderId) =>
      startProcessing({ variables: { input: { orderId } } }),
    markReady: (orderId) => markReady({ variables: { input: { orderId } } }),
    markAwaitingPickup: (orderId) =>
      markAwaitingPickup({ variables: { input: { orderId } } }),
    markAwaitingDelivery: (orderId) =>
      markAwaitingDelivery({ variables: { input: { orderId } } }),
    complete: (orderId) => complete({ variables: { input: { orderId } } }),
    cancel: (orderId) => cancel({ variables: { input: { orderId } } }),
    reject: (orderId) => reject({ variables: { input: { orderId } } }),
    markLost: (orderId) => markLost({ variables: { input: { orderId } } }),
    markDamaged: (orderId) => markDamaged({ variables: { input: { orderId } } }),
    refund: (orderId) => refund({ variables: { input: { orderId } } }),
  };

  const [actionError, setActionError] = useState<string | undefined>(undefined);
  const [weightKg, setWeightKg] = useState('');
  const [baseServiceId, setBaseServiceId] = useState('');
  const [pending, setPending] = useState<RefVerb | null>(null);
  const [confirmVerb, setConfirmVerb] = useState<RefVerb | null>(null);

  const order = data?.laundryOrder;
  const services = servicesData?.services.nodes ?? [];

  async function run(fn: () => Promise<unknown>, failMsg: string) {
    setActionError(undefined);
    try {
      await fn();
      await refetch();
      onChanged();
    } catch {
      setActionError(failMsg);
    }
  }

  if (loading) {
    return (
      <DetailDrawer open onClose={onClose} title="Laundry order">
        <LoadingState />
      </DetailDrawer>
    );
  }
  if (error || !order) {
    return (
      <DetailDrawer open onClose={onClose} title="Laundry order">
        <ErrorState message="Unable to load laundry order." />
      </DetailDrawer>
    );
  }

  const legalTargets = MATRIX[order.status];
  const refActions = legalTargets
    .map((target) => TARGET_TO_VERB[target])
    .filter((v): v is RefVerb => v !== undefined)
    .filter((v) => {
      if (v === 'markAwaitingPickup') return order.fulfillmentType === 'PICKUP';
      if (v === 'markAwaitingDelivery') return order.fulfillmentType === 'DELIVERY';
      return true;
    });
  const canWeigh = order.status === 'RECEIVED' || order.status === 'WEIGHED';
  const canPrice = order.status === 'WEIGHED';

  return (
    <DetailDrawer
      open
      onClose={onClose}
      title={`${order.customer.fullName} — Laundry`}
    >
      <div className="flex flex-col gap-6">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-slate-500">Customer</dt>
          <dd className="text-slate-900">{order.customer.fullName}</dd>
          <dt className="text-slate-500">Fulfillment</dt>
          <dd className="text-slate-900">{order.fulfillmentType}</dd>
          <dt className="text-slate-500">Status</dt>
          <dd>
            <StatusBadge
              label={order.status}
              tone={STATUS_TONE[order.status]}
            />
          </dd>
          <dt className="text-slate-500">Weight</dt>
          <dd className="text-slate-900">{formatWeight(order.weightGrams)}</dd>
          <dt className="text-slate-500">Total</dt>
          <dd className="text-slate-900">
            {order.totalMinorUnits === null
              ? '—'
              : formatMinorUnits(order.totalMinorUnits)}
          </dd>
        </dl>

        {order.lines.nodes.length > 0 ? (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Lines</h3>
            <ul className="flex flex-col gap-2 text-sm">
              {order.lines.nodes.map((line) => (
                <li
                  key={line.id}
                  className="rounded-md border border-slate-200 p-2"
                >
                  <div className="text-slate-900">
                    {line.serviceId ? 'Service' : 'Add-on'} ·{' '}
                    {line.pricingSnapshot.unit} · qty{' '}
                    {line.pricingSnapshot.quantity}
                  </div>
                  <div className="text-slate-600">
                    {formatMinorUnits(line.pricingSnapshot.amountMinorUnits)}
                    {line.pricingSnapshot.minimumChargeApplied
                      ? ' (minimum charge applied)'
                      : ''}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {canWeigh ? (
          <div className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="laundry-weight" className="text-sm font-medium text-slate-700">
                Weight (kg)
              </label>
              <input
                id="laundry-weight"
                type="number"
                min={0}
                step="0.01"
                value={weightKg}
                onChange={(e) => setWeightKg(e.currentTarget.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={weightKg === ''}
              onClick={() =>
                void run(
                  () =>
                    weigh({
                      variables: {
                        input: {
                          orderId: order.id,
                          weightGrams: Math.round(Number(weightKg) * 1000),
                        },
                      },
                    }),
                  'Unable to record weight.',
                )
              }
            >
              Record weight
            </Button>
          </div>
        ) : null}

        {canPrice ? (
          <div className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="laundry-service" className="text-sm font-medium text-slate-700">
                Base service
              </label>
              <select
                id="laundry-service"
                value={baseServiceId}
                onChange={(e) => setBaseServiceId(e.currentTarget.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <option value="">Select a service</option>
                {services
                  .filter((s) => s.active)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={baseServiceId === ''}
              onClick={() =>
                void run(
                  () =>
                    price({
                      variables: {
                        input: {
                          orderId: order.id,
                          baseServiceId,
                          addOns: [],
                        },
                      },
                    }),
                  'Unable to price order.',
                )
              }
            >
              Price order
            </Button>
          </div>
        ) : null}

        {refActions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {refActions.map((verb) => (
              <Button
                key={verb}
                type="button"
                variant={DESTRUCTIVE.has(verb) ? 'secondary' : 'primary'}
                disabled={pending !== null}
                onClick={() => {
                  if (DESTRUCTIVE.has(verb)) {
                    setConfirmVerb(verb);
                    return;
                  }
                  setPending(verb);
                  void run(
                    () => refRunners[verb](order.id),
                    `Unable to ${VERB_LABEL[verb].toLowerCase()}.`,
                  ).finally(() => setPending(null));
                }}
              >
                {VERB_LABEL[verb]}
              </Button>
            ))}
          </div>
        ) : null}

        {actionError ? (
          <p className="text-sm text-red-600">{actionError}</p>
        ) : null}
      </div>

      {confirmVerb ? (
        <ConfirmDialog
          open
          onClose={() => setConfirmVerb(null)}
          onConfirm={async () => {
            const verb = confirmVerb;
            setConfirmVerb(null);
            await run(
              () => refRunners[verb](order.id),
              `Unable to ${VERB_LABEL[verb].toLowerCase()}.`,
            );
          }}
          title={VERB_LABEL[confirmVerb]}
          description={`This will ${VERB_LABEL[
            confirmVerb
          ].toLowerCase()}. This cannot be undone.`}
          confirmLabel={VERB_LABEL[confirmVerb]}
        />
      ) : null}
    </DetailDrawer>
  );
}
