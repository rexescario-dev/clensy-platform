'use client';

import { useInvoiceQuery, useInvoicesQuery } from '@clensy/client';
import type { InvoicePaymentStatus } from '@clensy/client';
import {
  DataTable,
  DetailDrawer,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '@clensy/ui';
import type { DataTableColumn, StatusTone } from '@clensy/ui';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { formatMinorUnits } from '../../../lib/format-price';
import { useDetailDrawer } from '../../../lib/use-detail-drawer';

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  totalMinorUnits: number;
  amountDueMinorUnits: number;
  paymentStatus: InvoicePaymentStatus;
  issueDate: unknown;
  customer: { id: string; fullName: string };
  [key: string]: unknown;
};

const STATUS_TONE: Record<InvoicePaymentStatus, StatusTone> = {
  UNPAID: 'neutral',
  PARTIALLY_PAID: 'warning',
  PAID: 'success',
  VOID: 'danger',
};

function formatDate(value: unknown): string {
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
}

export default function BillingPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <BillingPageContent />
    </Suspense>
  );
}

function BillingPageContent() {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const invoicesQuery = useInvoicesQuery({
    fetchPolicy: 'network-only',
    variables: { paging: { limit: pageSize, offset: (page - 1) * pageSize } },
  });
  const { activeId, open: openDetail, close: closeDetail } = useDetailDrawer();

  const columns: DataTableColumn<InvoiceRow>[] = [
    { key: 'number', header: 'Invoice', render: (r) => r.invoiceNumber },
    { key: 'customer', header: 'Customer', render: (r) => r.customer.fullName },
    {
      key: 'total',
      header: 'Total',
      render: (r) => formatMinorUnits(r.totalMinorUnits),
    },
    {
      key: 'due',
      header: 'Amount due',
      render: (r) => formatMinorUnits(r.amountDueMinorUnits),
    },
    {
      key: 'status',
      header: 'Payment',
      render: (r) => (
        <StatusBadge
          label={r.paymentStatus}
          tone={STATUS_TONE[r.paymentStatus]}
        />
      ),
    },
    { key: 'issued', header: 'Issued', render: (r) => formatDate(r.issueDate) },
  ];

  const rows = (invoicesQuery.data?.invoices.nodes ?? []) as InvoiceRow[];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Invoices" />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        emptyMessage="No invoices."
        loading={invoicesQuery.loading}
        error={invoicesQuery.error ? 'Unable to load invoices.' : undefined}
        onRowClick={(r) => openDetail(r.id)}
        pagination={{
          page,
          pageSize,
          totalCount: invoicesQuery.data?.invoices.totalCount ?? 0,
          onPageChange: setPage,
        }}
      />

      {activeId ? (
        <InvoiceDetailDrawer id={activeId} onClose={closeDetail} />
      ) : null}
    </div>
  );
}

function InvoiceDetailDrawer({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const { data, loading, error } = useInvoiceQuery({
    variables: { id },
    fetchPolicy: 'network-only',
  });
  const invoice = data?.invoice;

  if (loading) {
    return (
      <DetailDrawer open onClose={onClose} title="Invoice">
        <LoadingState />
      </DetailDrawer>
    );
  }
  if (error || !invoice) {
    return (
      <DetailDrawer open onClose={onClose} title="Invoice">
        <ErrorState message="Unable to load invoice." />
      </DetailDrawer>
    );
  }

  return (
    <DetailDrawer open onClose={onClose} title={invoice.invoiceNumber}>
      <div className="flex flex-col gap-6">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-slate-500">Customer</dt>
          <dd className="text-slate-900">{invoice.customer.fullName}</dd>
          <dt className="text-slate-500">Laundry order</dt>
          <dd className="text-slate-900">
            <Link
              className="text-slate-900 underline"
              href={`/app/laundry?detail=${invoice.laundryOrderId}`}
            >
              {invoice.laundryOrderId.slice(0, 8)}
            </Link>
          </dd>
          <dt className="text-slate-500">Payment terms</dt>
          <dd className="text-slate-900">{invoice.paymentTerms}</dd>
          <dt className="text-slate-500">Issued</dt>
          <dd className="text-slate-900">{formatDate(invoice.issueDate)}</dd>
          <dt className="text-slate-500">Due</dt>
          <dd className="text-slate-900">
            {invoice.dueDate ? formatDate(invoice.dueDate) : '—'}
          </dd>
          <dt className="text-slate-500">Payment status</dt>
          <dd>
            <StatusBadge
              label={invoice.paymentStatus}
              tone={STATUS_TONE[invoice.paymentStatus]}
            />
          </dd>
        </dl>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-slate-500">Subtotal</dt>
          <dd className="text-slate-900">
            {formatMinorUnits(invoice.subtotalMinorUnits)}
          </dd>
          <dt className="text-slate-500">Discount</dt>
          <dd className="text-slate-900">
            {formatMinorUnits(invoice.discountMinorUnits)}
          </dd>
          <dt className="text-slate-500">Total</dt>
          <dd className="text-slate-900">
            {formatMinorUnits(invoice.totalMinorUnits)}
          </dd>
          <dt className="text-slate-500">Paid</dt>
          <dd className="text-slate-900">
            {formatMinorUnits(invoice.amountPaidMinorUnits)}
          </dd>
          <dt className="text-slate-500">Amount due</dt>
          <dd className="text-slate-900">
            {formatMinorUnits(invoice.amountDueMinorUnits)}
          </dd>
        </dl>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Lines</h3>
          <ul className="flex flex-col gap-2 text-sm">
            {invoice.lines.nodes.map((line) => (
              <li
                key={line.id}
                className="rounded-md border border-slate-200 p-2"
              >
                <div className="text-slate-900">{line.description}</div>
                <div className="text-slate-600">
                  {line.unit} · qty {line.quantity} ·{' '}
                  {formatMinorUnits(line.rateMinorUnits)} ·{' '}
                  {formatMinorUnits(line.amountMinorUnits)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </DetailDrawer>
  );
}
