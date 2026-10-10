import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// Characterization (#157): pins what today's `/app/laundry` list renders,
// before #163 replaces it, so later issues can show the delta. It is not a
// target: raw enum labels and the 2-decimal weight are today's behavior.
const order = {
  id: 'o1',
  createdAt: '2026-10-01T09:00:00.000Z',
  customer: { id: 'c1', fullName: 'Ana Reyes' },
  fulfillmentType: 'DELIVERY',
  status: 'AWAITING_PAYMENT',
  totalMinorUnits: 45000,
  weightGrams: 2500,
};

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/laundry',
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@clensy/client', () => {
  const idle = () => [vi.fn(), { loading: false }];
  const query = () => ({ data: undefined, error: undefined, loading: false, refetch: vi.fn() });
  return {
    useCancelLaundryOrderMutation: idle,
    useCompleteLaundryOrderMutation: idle,
    useCurrentAdminQuery: query,
    useCustomersQuery: () => ({ data: { customers: { nodes: [] } } }),
    useGenerateInvoiceFromOrderMutation: idle,
    useInvoiceForOrderQuery: query,
    useLaundryOrderQuery: query,
    useLaundryOrdersQuery: () => ({
      data: { laundryOrders: { nodes: [order], totalCount: 1 } },
      error: undefined,
      loading: false,
      refetch: vi.fn(),
    }),
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

describe('/app/laundry list (baseline characterization)', () => {
  it('shows customer, raw status and fulfillment, weight and total for each order', async () => {
    const { default: LaundryPage } = await import('../app/app/laundry/page');
    const html = renderToStaticMarkup(<LaundryPage />);
    expect(html).toContain('Ana Reyes');
    expect(html).toContain('AWAITING_PAYMENT');
    expect(html).toContain('DELIVERY');
    expect(html).toContain('2.50 kg');
    expect(html).toContain('₱450.00');
  });
});
