import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The redesigned `/app/laundry` list (#163). Replaces the #157 baseline
// characterization, which pinned the raw enum labels and 2-decimal weight
// this issue removes.
const order = {
  id: '3f2a9c1e-0b7d-4e55-9a10-6c2b8d4e7f01',
  createdAt: '2026-10-01T09:00:00.000Z',
  customer: { id: 'c1', fullName: 'Ana Reyes' },
  fulfillmentType: 'DELIVERY',
  status: 'AWAITING_PAYMENT',
  totalMinorUnits: 45000,
  weightGrams: 2505,
};

const page = vi.hoisted(() => ({
  orderQueryOptions: [] as unknown[],
  ordersQueryOptions: [] as unknown[],
  role: 'TENANT_OWNER' as string | undefined,
  search: '',
  totalCount: 1,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/laundry',
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(page.search),
}));

vi.mock('@clensy/client', () => {
  const idle = () => [vi.fn(), { loading: false }];
  const query = () => ({ data: undefined, error: undefined, loading: false, refetch: vi.fn() });
  return {
    useCancelLaundryOrderMutation: idle,
    useCompleteLaundryOrderMutation: idle,
    useCurrentAdminQuery: () => ({
      data: page.role === undefined ? undefined : { currentAdmin: { role: page.role } },
    }),
    useCustomersQuery: () => ({ data: { customers: { nodes: [] } } }),
    useGenerateInvoiceFromOrderMutation: idle,
    useInvoiceForOrderQuery: query,
    useLaundryOrderQuery: (options: unknown) => {
      page.orderQueryOptions.push(options);
      return query();
    },
    useLaundryOrdersQuery: (options: unknown) => {
      page.ordersQueryOptions.push(options);
      return {
        data: { laundryOrders: { nodes: [order], totalCount: page.totalCount } },
        error: undefined,
        loading: false,
        previousData: undefined,
        refetch: vi.fn(),
      };
    },
    useMarkLaundryOrderAwaitingDeliveryMutation: idle,
    useMarkLaundryOrderAwaitingPaymentMutation: idle,
    useMarkLaundryOrderAwaitingPickupMutation: idle,
    useMarkLaundryOrderDamagedMutation: idle,
    useMarkLaundryOrderLostMutation: idle,
    useMarkLaundryOrderPaidMutation: idle,
    useMarkLaundryOrderReadyMutation: idle,
    usePriceLaundryOrderMutation: idle,
    useReceiveLaundryOrderMutation: idle,
    useRefundLaundryOrderMutation: idle,
    useRejectLaundryOrderMutation: idle,
    useServicesQuery: query,
    useStartLaundryProcessingMutation: idle,
    useWeighLaundryOrderMutation: idle,
  };
});

async function renderPage(): Promise<string> {
  const { default: LaundryPage } = await import('../app/app/laundry/page');
  return renderToStaticMarkup(<LaundryPage />);
}

beforeEach(() => {
  page.orderQueryOptions = [];
  page.ordersQueryOptions = [];
  page.role = 'TENANT_OWNER';
  page.search = '';
  page.totalCount = 1;
});

describe('/app/laundry list', () => {
  it('shows human status and fulfillment labels and the shared weight and money formats', async () => {
    const html = await renderPage();
    expect(html).toContain('Ana Reyes');
    expect(html).toContain('Awaiting payment');
    expect(html).not.toContain('>AWAITING_PAYMENT<');
    expect(html).toContain('Delivery');
    expect(html).toContain('2.505 kg');
    expect(html).toContain('₱450.00');
  });

  it('queries page 1 of 20 by createdAt DESC, id ASC, with no filter by default', async () => {
    await renderPage();
    expect(page.ordersQueryOptions.at(-1)).toMatchObject({
      variables: {
        filter: undefined,
        paging: { limit: 20, offset: 0 },
        sorting: [
          { direction: 'DESC', field: 'createdAt' },
          { direction: 'ASC', field: 'id' },
        ],
      },
    });
  });

  it('sends the URL search and filters to laundryOrders as a server filter', async () => {
    page.search = 'q=ana&status=READY&fulfillment=PICKUP&sortBy=status&sortOrder=asc&offset=20';
    const html = await renderPage();
    expect(page.ordersQueryOptions.at(-1)).toMatchObject({
      variables: {
        filter: {
          customer: { fullName: { iLike: '%ana%' } },
          fulfillmentType: { eq: 'PICKUP' },
          status: { eq: 'READY' },
        },
        paging: { limit: 20, offset: 20 },
        sorting: [
          { direction: 'ASC', field: 'status' },
          { direction: 'ASC', field: 'id' },
        ],
      },
    });
    expect(html).toContain('value="ana"');
    expect(html).toContain('Clear search and filters');
    // The header indicator shows the same sort the server received.
    expect(html).toMatch(/<th[^>]*aria-sort="ascending"[^>]*><button[^>]*>Status</);
  });

  it('labels the page from the URL offset and the server total', async () => {
    page.search = 'offset=20';
    page.totalCount = 41;
    const html = await renderPage();
    expect(page.ordersQueryOptions.at(-1)).toMatchObject({ variables: { paging: { limit: 20, offset: 20 } } });
    expect(html).toContain('Page 2 of 3');
  });

  it('shows the create button only to intake roles', async () => {
    for (const role of ['TENANT_OWNER', 'OPS_MANAGER', 'SCHEDULER', 'CUSTOMER_SUPPORT']) {
      page.role = role;
      expect(await renderPage()).toContain('+ New Laundry Order');
    }
    for (const role of ['ANALYST', 'FINANCE', 'SUPER_ADMIN', undefined]) {
      page.role = role;
      expect(await renderPage()).not.toContain('+ New Laundry Order');
    }
  });

  it('keeps the drawer for ?detail= until the order page cutover, loading that order', async () => {
    page.search = `q=ana&detail=${order.id}`;
    const html = await renderPage();
    expect(page.orderQueryOptions.at(-1)).toMatchObject({ variables: { id: order.id } });
    // The drawer mounted; its idle mocked query renders the drawer's error state.
    expect(html).toContain('Unable to load laundry order.');
    // The list keeps its own filter alongside the drawer.
    expect(page.ordersQueryOptions.at(-1)).toMatchObject({
      variables: { filter: { customer: { fullName: { iLike: '%ana%' } } } },
    });
  });
});
