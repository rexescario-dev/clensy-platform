'use client';

import { useCurrentAdminQuery, useLaundryOrdersQuery } from '@clensy/client';
import { Button, LoadingState, PageHeader, useToast } from '@clensy/ui';
import {
  LaundryOrderDataTable,
  canReceiveLaundryOrder,
  useClensyTranslations,
  type LaundryOrderRow,
} from '@clensy/web';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { CreateLaundryOrderDialog } from '../../../components/laundry/create-laundry-order-dialog';
import { formatMinorUnits } from '../../../lib/format-price';
import { laundryOrdersQueryVariables } from '../../../lib/laundry-order-list-query';
import { laundryDetailRedirectHref, laundryOrderHref } from '../../../lib/laundry-order-page';
import { canViewPath } from '../../../lib/nav-groups';
import {
  LAUNDRY_ORDER_PAGE_SIZE,
  hasActiveLaundryFilters,
  laundryListFiltersCleared,
  useLaundryOrderListUrlState,
  withLaundryFilterChange,
  withLaundryPage,
  withLaundrySort,
} from '../../../lib/use-laundry-order-list-url-state';
import { useLaundrySearchDraft } from '../../../lib/use-laundry-search-draft';

export default function LaundryPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <LaundryRoute />
    </Suspense>
  );
}

// `/app/laundry?detail=<id>` links from before the order page keep working
// (lifecycle spec §8.4.4): the list is not mounted, so its query never runs
// and no native list write can land over the redirect.
function LaundryRoute() {
  const redirectHref = laundryDetailRedirectHref(useSearchParams());
  return redirectHref === null ? <LaundryPageContent /> : <LaundryDetailRedirect href={redirectHref} />;
}

function LaundryDetailRedirect({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(href);
  }, [router, href]);
  return <LoadingState />;
}

function LaundryPageContent() {
  const t = useClensyTranslations('laundry');
  const { setState: setListState, state: listState } = useLaundryOrderListUrlState();
  const ordersQuery = useLaundryOrdersQuery({
    fetchPolicy: 'network-only',
    notifyOnNetworkStatusChange: true,
    variables: laundryOrdersQueryVariables(listState),
  });
  const { data: adminData } = useCurrentAdminQuery();
  const canCreate = canReceiveLaundryOrder(adminData?.currentAdmin.role);
  const principal = adminData?.currentAdmin;
  const toast = useToast();
  const router = useRouter();

  const search = useLaundrySearchDraft(listState.search, (text) =>
    setListState((current) => withLaundryFilterChange(current, { search: text })),
  );

  function handleClearFilters() {
    search.reset();
    setListState(laundryListFiltersCleared);
  }

  // A row and a successful create open the order page (lifecycle spec
  // §8.4.4). A search still waiting to commit is written to the list entry
  // first, natively, so it never applies after the page has left and Back
  // returns to the list as typed.
  function openOrder(id: string) {
    const pendingSearch = search.takePending();
    if (pendingSearch !== undefined) {
      setListState((current) => withLaundryFilterChange(current, { search: pendingSearch }));
    }
    router.push(laundryOrderHref(id));
  }

  const [formOpen, setFormOpen] = useState(false);
  // A new key per opening remounts the dialog, so every opening starts with
  // no customer, customer pickup, no errors and a released submit guard (#160).
  const [formKey, setFormKey] = useState(0);

  function openCreateForm() {
    setFormKey((key) => key + 1);
    setFormOpen(true);
  }

  // The new order opens at once, with the id the mutation returned. The
  // list is left, and its `network-only` query runs again on Back, so it
  // is not refreshed here (#161 plan decision c).
  function handleCreated(orderId: string) {
    setFormOpen(false);
    toast.success(t('create.success'));
    openOrder(orderId);
  }

  // Rows stay on screen while a new page, sort or filter loads, and after
  // a background error (the bookings list pattern).
  const effectiveData = ordersQuery.data ?? ordersQuery.previousData;
  const rows: LaundryOrderRow[] = effectiveData?.laundryOrders.nodes ?? [];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t('list.title')}
        actions={
          canCreate ? (
            <Button type="button" onClick={openCreateForm}>
              {t('list.create')}
            </Button>
          ) : undefined
        }
      />

      <LaundryOrderDataTable
        orders={rows}
        formatPrice={formatMinorUnits}
        loading={ordersQuery.loading && !effectiveData}
        refreshing={ordersQuery.loading && Boolean(effectiveData)}
        hasError={Boolean(ordersQuery.error)}
        onRowClick={(row: LaundryOrderRow) => openOrder(row.id)}
        filters={{ fulfillment: listState.fulfillment, search: search.draft, status: listState.status }}
        filtersActive={hasActiveLaundryFilters(listState) || search.draft.trim() !== ''}
        onSearchChange={search.change}
        onStatusChange={(status) => setListState((current) => withLaundryFilterChange(current, { status }))}
        onFulfillmentChange={(fulfillment) =>
          setListState((current) => withLaundryFilterChange(current, { fulfillment }))
        }
        onClearFilters={handleClearFilters}
        sort={{ direction: listState.sortOrder, key: listState.sortBy }}
        onSortChange={(next) => setListState((current) => withLaundrySort(current, next))}
        pagination={{
          onPageChange: (page) => setListState((current) => withLaundryPage(current, page)),
          page: listState.offset / LAUNDRY_ORDER_PAGE_SIZE + 1,
          pageSize: LAUNDRY_ORDER_PAGE_SIZE,
          totalCount: effectiveData?.laundryOrders.totalCount ?? 0,
        }}
      />

      <CreateLaundryOrderDialog
        key={formKey}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={handleCreated}
        showAddCustomerLink={principal ? canViewPath(principal, '/app/customers') : false}
      />

    </div>
  );
}
