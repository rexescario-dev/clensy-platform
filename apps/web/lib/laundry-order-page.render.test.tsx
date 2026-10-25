import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@clensy/ui';

// The `/app/laundry/[id]` order page (#156), rendered statically.
const ID = '3f2a9c1e-0b7d-4e55-9a10-6c2b8d4e7f01';

type Line = {
  addOnId: string | null;
  createdAt: string;
  id: string;
  pricingSnapshot: {
    amountMinorUnits: number;
    description: string;
    minimumChargeApplied: boolean;
    minimumChargeMinorUnits: number | null;
    pricingRuleId: string | null;
    quantity: number;
    rateMinorUnits: number;
    unit: 'FLAT' | 'PER_ITEM' | 'PER_KG' | 'PER_SERVICE';
  };
  serviceId: string | null;
};

function line(id: string, unit: Line['pricingSnapshot']['unit'], quantity: number, amount: number, extra: Partial<Line> = {}): Line {
  return {
    id,
    addOnId: null,
    serviceId: 's1',
    createdAt: '2026-10-01T09:00:00.000Z',
    pricingSnapshot: {
      pricingRuleId: null,
      amountMinorUnits: amount,
      description: 'Wash & fold',
      minimumChargeApplied: false,
      minimumChargeMinorUnits: null,
      quantity,
      rateMinorUnits: 0,
      unit,
    },
    ...extra,
  };
}

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: ID,
    createdAt: '2026-10-01T09:00:00.000Z',
    customer: { fullName: 'Ana Reyes', id: 'c1' },
    fulfillmentType: 'DELIVERY',
    lines: { nodes: [] as Line[], pageInfo: { hasNextPage: false } },
    status: 'AWAITING_PAYMENT',
    totalMinorUnits: 45000,
    weightGrams: 2505,
    ...overrides,
  };
}

const page = vi.hoisted(() => ({
  id: '',
  // Every call of the catalog pickers and of the pricing mutation.
  addOnsCalls: [] as unknown[],
  invoiceError: undefined as Error | undefined,
  invoiceLoading: false,
  invoiceNodes: [] as unknown[],
  invoiceOptions: [] as Array<{ skip?: boolean; variables?: unknown }>,
  // Apollo keeps earlier data while a query reloads or after it fails.
  invoiceRetained: false,
  // A finished result that lacks data or the invoice connection (M5 review 3).
  invoiceShape: 'nodes' as 'noConnection' | 'noData' | 'nodes',
  order: undefined as unknown,
  orderError: undefined as Error | undefined,
  orderLoading: false,
  orderOptions: [] as Array<{ fetchPolicy?: string; skip?: boolean; variables?: unknown }>,
  // Apollo keeps an earlier order's data while the query reloads or after it fails.
  orderRetained: false,
  // The preview request of `useLaundryServiceSelection`; a static render sends none.
  previewQuery: vi.fn(),
  priceMutationCalls: [] as unknown[],
  role: 'TENANT_OWNER' as string | undefined,
  servicesCalls: [] as unknown[],
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: page.id }),
  usePathname: () => `/app/laundry/${page.id}`,
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

vi.mock('@apollo/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@apollo/client')>()),
  useApolloClient: () => ({ query: page.previewQuery }),
}));

vi.mock('@clensy/client', () => ({
  PreviewLaundryOrderPriceDocument: {},
  useAddOnsQuery: (options: unknown) => {
    page.addOnsCalls.push(options);
    return { data: undefined, error: undefined, loading: false };
  },
  useCancelLaundryOrderMutation: () => [() => Promise.resolve({ data: {} }), { loading: false }],
  useCompleteLaundryOrderMutation: () => [() => Promise.resolve({ data: {} }), { loading: false }],
  useCurrentAdminQuery: () => ({
    data: page.role === undefined ? undefined : { currentAdmin: { role: page.role } },
  }),
  // The Invoice and payment section's mutations (#166); never called by a
  // static render.
  useGenerateInvoiceFromOrderMutation: () => [() => Promise.resolve({ data: {} }), { loading: false }],
  useInvoiceForOrderQuery: (options: { skip?: boolean; variables?: unknown }) => {
    page.invoiceOptions.push(options);
    const refetch = () => Promise.resolve();
    if (page.invoiceShape !== 'nodes') {
      return { data: page.invoiceShape === 'noData' ? undefined : {}, error: undefined, loading: false, refetch };
    }
    return {
      data:
        page.invoiceRetained || (!page.invoiceLoading && !page.invoiceError)
          ? { invoices: { nodes: page.invoiceNodes } }
          : undefined,
      error: page.invoiceError,
      loading: page.invoiceLoading,
      refetch,
    };
  },
  useLaundryOrderQuery: (options: { fetchPolicy?: string; skip?: boolean; variables?: unknown }) => {
    page.orderOptions.push(options);
    if (options.skip) return { data: undefined, error: undefined, loading: false, refetch: () => Promise.resolve() };
    return {
      data:
        page.orderRetained || (!page.orderLoading && !page.orderError) ? { laundryOrder: page.order } : undefined,
      error: page.orderError,
      loading: page.orderLoading,
      refetch: () => Promise.resolve(),
    };
  },
  useMarkLaundryOrderAwaitingDeliveryMutation: () => [() => Promise.resolve({ data: {} }), { loading: false }],
  useMarkLaundryOrderAwaitingPaymentMutation: () => [() => Promise.resolve({ data: {} }), { loading: false }],
  useMarkLaundryOrderAwaitingPickupMutation: () => [() => Promise.resolve({ data: {} }), { loading: false }],
  useMarkLaundryOrderDamagedMutation: () => [() => Promise.resolve({ data: {} }), { loading: false }],
  useMarkLaundryOrderLostMutation: () => [() => Promise.resolve({ data: {} }), { loading: false }],
  useMarkLaundryOrderPaidMutation: () => [() => Promise.resolve({ data: {} }), { loading: false }],
  useMarkLaundryOrderReadyMutation: () => [() => Promise.resolve({ data: {} }), { loading: false }],
  usePriceLaundryOrderMutation: () => [
    (...args: unknown[]) => {
      page.priceMutationCalls.push(args);
      return Promise.resolve({ data: {} });
    },
    { loading: false },
  ],
  useRefundLaundryOrderMutation: () => [() => Promise.resolve({ data: {} }), { loading: false }],
  useRejectLaundryOrderMutation: () => [() => Promise.resolve({ data: {} }), { loading: false }],
  useServicesQuery: (options: unknown) => {
    page.servicesCalls.push(options);
    return { data: undefined, error: undefined, loading: false };
  },
  // The weighing editor's mutation; never called by a static render.
  useStartLaundryProcessingMutation: () => [() => Promise.resolve({ data: {} }), { loading: false }],
  useWeighLaundryOrderMutation: () => [() => Promise.resolve({ data: {} }), { loading: false }],
}));

// The app layout provides `ToastProvider`; the weighing editor needs it.
async function renderPage(): Promise<string> {
  const { default: LaundryOrderPage } = await import('../app/app/laundry/[id]/page');
  return renderToStaticMarkup(
    <ToastProvider>
      <LaundryOrderPage />
    </ToastProvider>,
  );
}

function count(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

// The markup of one section, from its opening tag to the next section.
function section(html: string, name: string): string {
  const start = html.indexOf(`id="laundry-order-${name}"`);
  expect(start).toBeGreaterThan(-1);
  const end = html.indexOf('<section', start);
  return html.slice(start, end === -1 ? undefined : end);
}

const BACK_LINK = 'href="/app/laundry"';

beforeEach(() => {
  page.id = ID;
  page.invoiceError = undefined;
  page.invoiceLoading = false;
  page.invoiceNodes = [];
  page.invoiceOptions.length = 0;
  page.invoiceRetained = false;
  page.invoiceShape = 'nodes';
  page.order = order();
  page.orderError = undefined;
  page.orderLoading = false;
  page.orderOptions.length = 0;
  page.orderRetained = false;
  page.previewQuery.mockReset();
  page.addOnsCalls.length = 0;
  page.servicesCalls.length = 0;
  page.priceMutationCalls.length = 0;
  page.role = 'TENANT_OWNER';
});

describe('laundry order page', () => {
  it('loads the order from the URL id, network-only, and its invoice', async () => {
    await renderPage();
    expect(page.orderOptions[0]).toMatchObject({ fetchPolicy: 'network-only', skip: false, variables: { id: ID } });
    expect(page.invoiceOptions[0]).toMatchObject({ skip: false, variables: { laundryOrderId: ID } });
  });

  it('renders the header, back link, no list or drawer, and no controls in the read-only sections', async () => {
    const html = await renderPage();
    expect(count(html, '<h1')).toBe(1);
    expect(html).toMatch(/<h1[^>]*>Ana Reyes<\/h1>/);
    expect(html).toContain(ID);
    expect(html).toContain('Awaiting payment');
    expect(html).not.toContain('>AWAITING_PAYMENT<');
    expect(html).toContain('Delivery');
    expect(html).toMatch(/<a[^>]*class="text-sm text-slate-600 underline"[^>]*href="\/app\/laundry"|<a[^>]*href="\/app\/laundry"[^>]*class="text-sm text-slate-600 underline"/);
    expect(html).toContain('Back to laundry orders');
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain('<table');
    // Weighing, Services, Price and Invoice and payment may hold controls
    // (#155, #158, #162, #166). Everything before the first section, and
    // Overview and Actions, stay read-only.
    const header = html.slice(0, html.indexOf('<section'));
    for (const part of [header, section(html, 'overview'), section(html, 'actions')]) {
      expect(part).not.toContain('<button');
      expect(part).not.toContain('<form');
      expect(part).not.toContain('<input');
    }
  });

  it('renders the summary as a responsive definition list', async () => {
    const html = await renderPage();
    expect(html).toContain('<dl class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">');
    expect(count(html, 'class="rounded-md border border-slate-200 p-3"')).toBeGreaterThanOrEqual(4);
    for (const term of ['Customer', 'Fulfillment', 'Weight', 'Total']) {
      expect(html).toContain(`>${term}</dt>`);
    }
    expect(html).toContain('2.505 kg');
    expect(html).toContain('₱450.00');
  });

  it('renders the section nav and six sections in order', async () => {
    const html = await renderPage();
    expect(html).toContain('<nav aria-label="Order sections">');
    expect(html).toContain('<ul class="flex gap-3 overflow-x-auto">');
    const names = ['overview', 'weighing', 'services', 'price', 'invoice', 'actions'];
    const positions = names.map((name) => html.indexOf(`href="#laundry-order-${name}"`));
    expect(positions.every((position) => position > -1)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(count(html, '<h2')).toBe(6);
    for (const heading of ['Overview', 'Weighing', 'Services', 'Price', 'Invoice and payment', 'Actions']) {
      expect(html).toContain(`<h2 class="text-base font-semibold text-slate-900">${heading}</h2>`);
    }
    expect(count(html, 'class="scroll-mt-6"')).toBe(6);
  });

  it('shows em dashes and no line list for a received order', async () => {
    page.order = order({ status: 'RECEIVED', totalMinorUnits: null, weightGrams: null });
    const html = await renderPage();
    expect(count(html, '>—</dd>')).toBe(2);
    expect(html).not.toContain('₱0.00');
    expect(section(html, 'overview')).toContain('No lines yet. Lines are added when the order is priced.');
    expect(section(html, 'overview')).not.toContain('<li');
    // TENANT_OWNER may weigh, so the editor replaces "Not weighed yet." (#155);
    // an unweighed order has no recorded line.
    expect(section(html, 'weighing')).not.toContain('Recorded weight');
    expect(section(html, 'services')).toContain('Weigh the order before choosing services.');
    expect(section(html, 'services')).not.toContain('No services selected yet.');
    expect(section(html, 'price')).toContain('Price is available after the order is weighed and services are chosen.');
    expect(section(html, 'price')).not.toContain('<button');
  });

  it('shows the recorded weight, and the Final price breakdown in Price only, once priced', async () => {
    const priced = (id: string, unit: Line['pricingSnapshot']['unit'], quantity: number, amount: number, rate: number, description: string, extra: Partial<Line> = {}, minimum: number | null = null) => {
      const base = line(id, unit, quantity, amount, extra);
      return {
        ...base,
        pricingSnapshot: {
          ...base.pricingSnapshot,
          description,
          minimumChargeApplied: minimum !== null,
          minimumChargeMinorUnits: minimum,
          rateMinorUnits: rate,
        },
      };
    };
    page.order = order({
      lines: {
        nodes: [
          priced('l1', 'PER_KG', 2505, 30000, 5000, 'Wash & fold', {}, 30000),
          priced('l2', 'PER_ITEM', 3, 9000, 3000, 'Ironing (add-on)', { addOnId: 'a1', serviceId: null }),
          priced('l3', 'FLAT', 1, 6000, 6000, 'Softener (add-on)', { addOnId: 'a2', serviceId: null }),
        ],
        pageInfo: { hasNextPage: false },
      },
      status: 'PRICED',
    });
    const html = await renderPage();
    const overview = section(html, 'overview');
    expect(overview).toContain('3 services priced.');
    expect(overview).toMatch(/<a[^>]*href="#laundry-order-price"[^>]*>See Price<\/a>/);
    expect(overview).not.toContain('#laundry-order-services');
    expect(overview).not.toContain('<li');
    const services = section(html, 'services');
    expect(services).toContain('Services are locked because this order has been priced.');
    expect(services).not.toContain('<li');
    expect(services).not.toContain('Wash &amp; fold');
    expect(services).not.toContain('₱');
    const price = section(html, 'price');
    expect(price).toContain('Final price');
    expect(price).not.toContain('Estimate');
    expect(price).not.toContain('Confirm price');
    expect(price).not.toContain('<button');
    expect(count(price, '<li')).toBe(3);
    for (const text of ['Wash &amp; fold', 'Ironing (add-on)', 'Softener (add-on)', '2.505 kg', '3 items', '₱50.00 per kg', '₱30.00 per item', '₱60.00 flat', '₱300.00', '₱90.00', 'Order total', '₱450.00']) {
      expect(price).toContain(text);
    }
    expect(count(price, 'Minimum charge applied')).toBe(1);
    expect(price).toContain('Minimum charge applied (₱300.00).');
    expect(price).not.toContain('More lines are not loaded.');
    expect(section(html, 'weighing')).toContain('Recorded weight');
    expect(section(html, 'weighing')).toContain('2.505 kg');
  });

  it('points to Price with a singular count for one saved line', async () => {
    page.order = order({ lines: { nodes: [line('l1', 'FLAT', 1, 100)], pageInfo: { hasNextPage: false } }, status: 'PRICED' });
    const overview = section(await renderPage(), 'overview');
    expect(overview).toContain('1 service priced.');
    expect(overview).not.toContain('1 services priced.');
    expect(overview).toContain('href="#laundry-order-price"');
  });

  describe('Services editor and views (#158)', () => {
    const OPERATIONAL = ['TENANT_OWNER', 'OPS_MANAGER', 'SCHEDULER', 'CUSTOMER_SUPPORT', 'FINANCE', 'ANALYST', 'SUPER_ADMIN'];

    it('offers the editor and the Estimate card to OPS_MANAGER on a weighed order, with controls only in Weighing, Services and Price', async () => {
      page.order = order({ status: 'WEIGHED', totalMinorUnits: null });
      page.role = 'OPS_MANAGER';
      const html = await renderPage();
      const services = section(html, 'services');
      expect(services).toMatch(/role="combobox"[^>]*/);
      expect(services).toMatch(/aria-label="Base service"|>Base service<\/label>/);
      expect(services).toContain('Add add-on');
      expect(services).not.toContain('Weigh the order');
      expect(services).not.toContain('No services selected yet.');
      expect(services).not.toContain('locked');
      const price = section(html, 'price');
      expect(price).toContain('>Estimate<');
      expect(price).not.toContain('Final price');
      expect(price).toContain('Select a base service to see an estimate.');
      expect(price).toMatch(/<button[^>]*disabled=""[^>]*>Confirm price<\/button>/);
      const outside = html.replace(section(html, 'weighing'), '').replace(services, '').replace(price, '');
      expect(outside).not.toContain('<button');
      expect(outside).not.toContain('<form');
      expect(outside).not.toContain('<input');
      // A static render runs no effects, so the first render sends no request.
      expect(page.previewQuery).not.toHaveBeenCalled();
      expect(page.priceMutationCalls).toEqual([]);
    });

    it('renders empty Services and Price bodies while the role loads on a weighed order with no total', async () => {
      page.order = order({ status: 'WEIGHED', totalMinorUnits: null });
      page.role = undefined;
      const html = await renderPage();
      const services = section(html, 'services');
      expect(services).toContain('<h2');
      expect(services).not.toContain('No services selected yet.');
      expect(services).not.toContain('<input');
      expect(services).not.toContain('Weigh the order');
      expect(services).toMatch(/<\/h2><div[^>]*><\/div><\/section>$/);
      expect(page.previewQuery).not.toHaveBeenCalled();
      const price = section(html, 'price');
      // The body is empty: only the heading renders.
      expect(price).toMatch(/<\/h2><div[^>]*><\/div><\/section>$/);
      for (const absent of ['Estimate', 'Confirm price', '<button', 'Price is available after', 'This order was not priced.', 'Final price']) {
        expect(price).not.toContain(absent);
      }
    });

    it.each(['CUSTOMER_SUPPORT', 'FINANCE', 'ANALYST', 'SUPER_ADMIN'])('shows %s no editor and no Confirm on a weighed order', async (role) => {
      page.order = order({ status: 'WEIGHED', totalMinorUnits: null });
      page.role = role;
      const html = await renderPage();
      const services = section(html, 'services');
      expect(services).toContain('No services selected yet.');
      expect(services).not.toContain('<input');
      expect(services).not.toContain('role="combobox"');
      expect(services).not.toContain('<button');
      expect(services).not.toContain('Base service');
      expect(page.previewQuery).not.toHaveBeenCalled();
      const price = section(html, 'price');
      expect(price).toContain('Price is available after the order is weighed and services are chosen.');
      expect(price).not.toContain('Confirm price');
      expect(price).not.toContain('<button');
      expect(price).not.toContain('Estimate');
    });

    it.each(OPERATIONAL)('asks %s to weigh a received order before choosing services', async (role) => {
      page.order = order({ status: 'RECEIVED', totalMinorUnits: null, weightGrams: null });
      page.role = role;
      const services = section(await renderPage(), 'services');
      expect(services).toContain('Weigh the order before choosing services.');
      expect(services).not.toContain('role="combobox"');
    });

    it('locks Services and shows the Final price to CUSTOMER_SUPPORT on a priced order', async () => {
      page.order = order({ lines: { nodes: [line('l1', 'FLAT', 1, 100)], pageInfo: { hasNextPage: false } }, status: 'PRICED' });
      page.role = 'CUSTOMER_SUPPORT';
      const html = await renderPage();
      const services = section(html, 'services');
      expect(services).toContain('Services are locked because this order has been priced.');
      expect(services).not.toContain('Wash &amp; fold');
      expect(services).not.toContain('<input');
      const price = section(html, 'price');
      expect(price).toContain('Final price');
      expect(price).toContain('Wash &amp; fold');
      expect(price).not.toContain('Confirm price');
    });

    it.each(['CANCELLED', 'REJECTED'])('never calls a %s order without a total priced, even with lines in the payload', async (status) => {
      page.order = order({ lines: { nodes: [line('l1', 'FLAT', 1, 100)], pageInfo: { hasNextPage: false } }, status, totalMinorUnits: null });
      const html = await renderPage();
      const services = section(html, 'services');
      expect(services).toContain('No services selected yet.');
      expect(services).not.toContain('has been priced');
      expect(services).not.toContain('Wash &amp; fold');
      expect(services).not.toContain('<input');
      const price = section(html, 'price');
      expect(price).toContain('This order was not priced.');
      expect(price).not.toContain('Estimate');
      expect(price).not.toContain('Final price');
    });

    it.each(['CANCELLED', 'REJECTED'])('says no services were selected on a %s order without lines', async (status) => {
      page.order = order({ status, totalMinorUnits: null });
      const services = section(await renderPage(), 'services');
      expect(services).toContain('No services selected yet.');
      expect(services).not.toContain('Services are locked');
      expect(section(await renderPage(), 'price')).toContain('This order was not priced.');
    });

    it('shows the Final price for an order cancelled after pricing (§4.3 note 5)', async () => {
      page.order = order({ lines: { nodes: [line('l1', 'FLAT', 1, 45000)], pageInfo: { hasNextPage: false } }, status: 'CANCELLED', totalMinorUnits: 45000 });
      page.role = 'TENANT_OWNER';
      const price = section(await renderPage(), 'price');
      expect(price).toContain('Final price');
      expect(price).toContain('₱450.00');
      expect(price).not.toContain('Confirm price');
    });

    it('shows the Final price while the role loads on a priced order', async () => {
      page.order = order({ status: 'PRICED' });
      page.role = undefined;
      expect(section(await renderPage(), 'price')).toContain('Final price');
    });

    // M5 round 1: inconsistent status/total pairs (owner decision 5).
    it('shows PRICED with no total as not priced, with no editor, Estimate or Confirm', async () => {
      page.order = order({ lines: { nodes: [], pageInfo: { hasNextPage: false } }, status: 'PRICED', totalMinorUnits: null });
      page.role = 'OPS_MANAGER';
      const html = await renderPage();
      const price = section(html, 'price');
      expect(price).toContain('This order was not priced.');
      expect(price).not.toContain('Estimate');
      expect(price).not.toContain('<button');
      const services = section(html, 'services');
      expect(services).toContain('No services selected yet.');
      expect(services).not.toContain('has been priced');
      expect(services).not.toContain('<input');
    });

    it('shows the Final price for a later status with a total, to a role that cannot price', async () => {
      page.order = order({ lines: { nodes: [line('l1', 'FLAT', 1, 45000)], pageInfo: { hasNextPage: false } }, status: 'PROCESSING', totalMinorUnits: 45000 });
      page.role = 'CUSTOMER_SUPPORT';
      const html = await renderPage();
      const price = section(html, 'price');
      expect(price).toContain('Final price');
      expect(price).toContain('₱450.00');
      expect(price).not.toContain('<button');
      expect(section(html, 'services')).toContain('Services are locked because this order has been priced.');
    });
  });

  // #155: controls appear only inside Weighing; every other section stays read-only.
  it('offers the weighing editor to an operational role on a received order, and controls only there', async () => {
    page.order = order({ status: 'RECEIVED', totalMinorUnits: null, weightGrams: null });
    page.role = 'OPS_MANAGER';
    const html = await renderPage();
    const weighing = section(html, 'weighing');
    expect(weighing).toContain('<form');
    expect(weighing).toContain('Add each bag, basket, or batch. The order weight is the total.');
    expect(weighing).toContain('>Bag 1</label>');
    expect(weighing).toMatch(/inputmode="decimal"/i);
    expect(weighing).toContain('Remove bag 1');
    expect(weighing).toContain('Add bag');
    expect(weighing).toContain('Combined weight');
    // The live total, by semantics, not by class string or attribute order.
    const totalTag = /<p\b[^>]*>0\.00 kg<\/p>/.exec(weighing)?.[0];
    expect(totalTag).toBeDefined();
    expect(totalTag).toContain('role="status"');
    expect(totalTag).toContain('aria-live="polite"');
    expect(weighing).toContain('Record weight');
    expect(weighing).not.toContain('Recorded weight');
    expect(weighing).not.toContain('Weight is locked');
    const outside = html.replace(weighing, '');
    expect(outside).not.toContain('<button');
    expect(outside).not.toContain('<form');
    expect(outside).not.toContain('<input');
  });

  it('shows the recorded weight above an editor prefilled with it for a re-weigh', async () => {
    page.order = order({ status: 'WEIGHED', totalMinorUnits: null, weightGrams: 2500 });
    page.role = 'SCHEDULER';
    const html = await renderPage();
    const weighing = section(html, 'weighing');
    expect(weighing.indexOf('Recorded weight')).toBeGreaterThan(-1);
    expect(weighing.indexOf('Recorded weight')).toBeLessThan(weighing.indexOf('<form'));
    expect(weighing).toContain('2.50 kg');
    expect(weighing).toContain('value="2.50"');
  });

  it.each([
    ['CUSTOMER_SUPPORT', 'RECEIVED', null, 'Not weighed yet.'],
    ['ANALYST', 'WEIGHED', 2505, '2.505 kg'],
    [undefined, 'RECEIVED', null, 'Not weighed yet.'],
    [undefined, 'WEIGHED', 2505, '2.505 kg'],
  ])('gives %s no editor on %s', async (role, status, weightGrams, shown) => {
    page.order = order({ status, totalMinorUnits: null, weightGrams });
    page.role = role;
    const weighing = section(await renderPage(), 'weighing');
    expect(weighing).toContain(shown);
    expect(weighing).not.toContain('<form');
    expect(weighing).not.toContain('<input');
    expect(weighing).not.toContain('Record weight');
    expect(weighing).not.toContain('Add bag');
    expect(weighing).not.toContain('Weight is locked');
  });

  it.each(['TENANT_OWNER', 'ANALYST'])('locks the weight of a priced order for %s', async (role) => {
    page.order = order({ status: 'PRICED' });
    page.role = role;
    const weighing = section(await renderPage(), 'weighing');
    expect(weighing).toContain('Weight is locked because this order has been priced.');
    expect(weighing).toContain('Recorded weight');
    expect(weighing).toContain('2.505 kg');
    expect(weighing).not.toContain('<form');
    expect(weighing).not.toContain('<input');
  });

  // #155 §Submit: after a recorded weight, a failed refetch leaves the
  // order query in error (Apollo keeps the old data and sets `error`). The
  // page then shows its order error state: the weight is not reported as
  // a weighing failure, and no stale editor stays on screen.
  // Characterization test: this is the #156 error branch, unchanged.
  it('shows the order error state, not a weighing failure, when the post-save reload fails', async () => {
    page.order = order({ status: 'WEIGHED', totalMinorUnits: null, weightGrams: 2500 });
    page.role = 'OPS_MANAGER';
    page.orderRetained = true;
    page.orderError = new Error('network');
    const html = await renderPage();
    expect(html).toContain('Unable to load laundry order.');
    expect(html).toContain(BACK_LINK);
    expect(html).not.toContain('Unable to record weight.');
    expect(html).not.toContain('<form');
  });

  it.each([
    ['CANCELLED', 2505, '2.505 kg'],
    ['CANCELLED', null, 'Not weighed yet.'],
    ['REJECTED', 2505, '2.505 kg'],
    ['REJECTED', null, 'Not weighed yet.'],
  ])('never calls a %s order priced (weight %s)', async (status, weightGrams, shown) => {
    page.order = order({ status, totalMinorUnits: null, weightGrams });
    page.role = 'TENANT_OWNER';
    const weighing = section(await renderPage(), 'weighing');
    expect(weighing).toContain(shown);
    expect(weighing).not.toContain('Weight is locked');
    expect(weighing).not.toContain('<form');
  });

  it('warns when more lines exist than were loaded', async () => {
    page.order = order({ lines: { nodes: [line('l1', 'FLAT', 1, 100)], pageInfo: { hasNextPage: true } } });
    const html = await renderPage();
    expect(section(html, 'price')).toContain('More lines are not loaded.');
    expect(section(html, 'services')).not.toContain('More lines are not loaded.');
    const overview = section(html, 'overview');
    expect(overview).toContain('Services are priced.');
    expect(overview).toContain('href="#laundry-order-price"');
    expect(overview).not.toMatch(/\d+ services? priced/);
  });

  it.each([
    ['RECEIVED', 'OPS_MANAGER', 'weighing'],
    ['WEIGHED', 'OPS_MANAGER', 'services'],
    ['PRICED', 'TENANT_OWNER', 'invoice'],
    ['PAID', 'SCHEDULER', 'actions'],
  ])('marks the next step forward as current: %s as %s → %s', async (status, role, current) => {
    page.order = order({ status });
    page.role = role;
    const html = await renderPage();
    expect(count(html, 'aria-current="true"')).toBe(1);
    expect(html).toMatch(new RegExp(`<a[^>]*href="#laundry-order-${current}"[^>]*aria-current="true"|<a[^>]*aria-current="true"[^>]*href="#laundry-order-${current}"`));
    expect(html).toMatch(new RegExp(`<a[^>]*href="#laundry-order-${current}"[^>]*class="[^"]*font-medium text-slate-900|<a[^>]*class="[^"]*font-medium text-slate-900[^"]*"[^>]*href="#laundry-order-${current}"`));
    // Seven nav links (#165 adds Activity), one of them current.
    expect(count(html, 'text-slate-600 whitespace-nowrap') + count(html, 'whitespace-nowrap text-slate-600')).toBe(6);
  });

  it('marks no section and names no action for ANALYST', async () => {
    page.role = 'ANALYST';
    const html = await renderPage();
    expect(html).not.toContain('aria-current="true"');
    expect(section(html, 'actions')).toContain('No further actions for this order.');
    expect(html).not.toContain('<button');
  });

  it('names the role-allowed lifecycle actions as text in Actions', async () => {
    page.order = order({ status: 'PRICED' });
    page.role = 'TENANT_OWNER';
    page.invoiceNodes = [{ id: 'i1', invoiceNumber: 'INV-0001', paymentStatus: 'UNPAID', totalMinorUnits: 45000 }];
    const html = await renderPage();
    const actions = section(html, 'actions');
    expect(actions).toContain('Available to your role:');
    // #166: the payment verbs are buttons in Invoice and payment.
    expect(actions).not.toContain('Mark awaiting payment');
    expect(actions).not.toContain('Mark paid');
    expect(actions).toContain('Cancel order');
    expect(actions).not.toContain('Generate invoice');
    expect(actions).not.toContain('Record weight');
    expect(actions).not.toContain('<button');
  });

  it('names nothing in Actions while the role loads', async () => {
    page.role = undefined;
    const html = await renderPage();
    const actions = section(html, 'actions');
    expect(actions).not.toContain('Available to your role:');
    expect(actions).not.toContain('No further actions for this order.');
    expect(html).not.toContain('aria-current="true"');
  });

  // PROCESSING: TENANT_OWNER may generate an invoice there but has no
  // payment verb, so only the invoice decides between Invoice and Actions
  // (#166 moved the payment verbs to Invoice and payment).
  it('shows the invoice and marks Actions once an invoice exists', async () => {
    page.order = order({ status: 'PROCESSING' });
    page.invoiceNodes = [{ id: 'i1', invoiceNumber: 'INV-0001', paymentStatus: 'UNPAID', totalMinorUnits: 45000 }];
    const html = await renderPage();
    const invoice = section(html, 'invoice');
    expect(invoice).toContain('INV-0001');
    expect(invoice).toContain('₱450.00');
    expect(invoice).toContain('Unpaid');
    expect(invoice).not.toContain('>UNPAID<');
    expect(html).toMatch(/<a[^>]*href="#laundry-order-actions"[^>]*aria-current="true"|<a[^>]*aria-current="true"[^>]*href="#laundry-order-actions"/);
  });

  // #166: an actor who may generate sees the terms form instead, so this
  // uses OPS_MANAGER, who may not.
  it('says when there is no invoice yet', async () => {
    page.role = 'OPS_MANAGER';
    const html = await renderPage();
    expect(section(html, 'invoice')).toContain('No invoice yet.');
  });

  it('says when the invoice cannot be loaded', async () => {
    page.invoiceError = new Error('network down');
    const html = await renderPage();
    expect(section(html, 'invoice')).toContain('Unable to load invoice.');
    expect(section(html, 'invoice')).not.toContain('No invoice yet.');
  });

  // M5 review 1: retained "no invoice" data would mark Invoice and say
  // "No invoice yet." if it were read. It is not: the nav falls through to
  // Actions (TENANT_OWNER may mark a PROCESSING order ready) and the
  // section shows the error.
  it('ignores retained invoice data while the invoice query has failed', async () => {
    page.order = order({ status: 'PROCESSING' });
    page.invoiceNodes = [];
    page.invoiceRetained = true;
    page.invoiceError = new Error('network down');
    const html = await renderPage();
    expect(html).not.toMatch(/<a[^>]*href="#laundry-order-invoice"[^>]*aria-current="true"/);
    expect(html).toMatch(/<a[^>]*href="#laundry-order-actions"[^>]*aria-current="true"/);
    expect(section(html, 'invoice')).toContain('Unable to load invoice.');
    expect(section(html, 'invoice')).not.toContain('No invoice yet.');
  });

  it('ignores retained invoice data while the invoice query reloads', async () => {
    page.order = order({ status: 'PROCESSING' });
    page.invoiceNodes = [];
    page.invoiceRetained = true;
    page.invoiceLoading = true;
    const html = await renderPage();
    expect(html).not.toMatch(/<a[^>]*href="#laundry-order-invoice"[^>]*aria-current="true"/);
    expect(html).toMatch(/<a[^>]*href="#laundry-order-actions"[^>]*aria-current="true"/);
    expect(section(html, 'invoice')).not.toContain('No invoice yet.');
    expect(section(html, 'invoice')).not.toContain('Unable to load invoice.');
    // The invoice card alone shows LoadingState (#166).
    expect(section(html, 'invoice')).toContain('role="status"');
  });

  // M5 review 3: only a confirmed node list says whether an invoice exists.
  it.each([
    ['with no data', 'noData'],
    ['without the invoice connection', 'noConnection'],
  ] as const)('treats a finished invoice result %s as unresolved', async (_label, shape) => {
    page.order = order({ status: 'PROCESSING' });
    page.invoiceShape = shape;
    const html = await renderPage();
    expect(html).not.toMatch(/<a[^>]*href="#laundry-order-invoice"[^>]*aria-current="true"/);
    expect(html).toMatch(/<a[^>]*href="#laundry-order-actions"[^>]*aria-current="true"/);
    expect(section(html, 'invoice')).not.toContain('No invoice yet.');
    expect(section(html, 'invoice')).not.toContain('Unable to load invoice.');
  });

  it('renders the shared progress with the payment branch current', async () => {
    const html = await renderPage();
    expect(html).toContain('aria-label="Order progress"');
    expect(html).toMatch(/<li aria-current="step"[^>]*>.*?Awaiting payment/);
  });

  it('renders the shared progress terminal sentence for a cancelled order', async () => {
    page.order = order({ status: 'CANCELLED', totalMinorUnits: null });
    const html = await renderPage();
    expect(html).toContain('This order was cancelled before payment.');
    expect(html).not.toContain('aria-label="Order progress"');
  });

  it('shows the loading state under the back link', async () => {
    page.orderLoading = true;
    const html = await renderPage();
    expect(html).toContain(BACK_LINK);
    expect(html).toContain('role="status"');
    expect(html).not.toContain('<h1');
  });

  // M5 review 2: an earlier order retained by Apollo is never shown while
  // the order query loads.
  it('shows the loading state, not a retained order, while the order query loads', async () => {
    page.orderRetained = true;
    page.orderLoading = true;
    const html = await renderPage();
    expect(html).toContain(BACK_LINK);
    expect(html).toContain('role="status"');
    expect(html).not.toContain('<h1');
    expect(html).not.toContain('Ana Reyes');
    expect(html).not.toContain('<nav');
    expect(html).not.toContain('<section');
    expect(html).not.toContain('<dl');
  });

  it('shows the error state, not a retained order, when the order query fails', async () => {
    page.orderRetained = true;
    page.orderError = new Error('boom');
    const html = await renderPage();
    expect(html).toContain('Unable to load laundry order.');
    expect(html).toContain(BACK_LINK);
    expect(html).not.toContain('<h1');
    expect(html).not.toContain('Ana Reyes');
    expect(html).not.toContain('<section');
  });

  it.each([
    ['a missing order', () => { page.order = null; }],
    ['a query error', () => { page.orderError = new Error('boom'); }],
  ])('shows the error state and the back link for %s', async (_label, arrange) => {
    arrange();
    const html = await renderPage();
    expect(html).toContain('Unable to load laundry order.');
    expect(html).toContain(BACK_LINK);
    expect(html).not.toContain('<h1');
  });

  it('shows the error state and sends no request for an id that is not a UUID', async () => {
    page.id = 'not-an-id';
    const html = await renderPage();
    expect(html).toContain('Unable to load laundry order.');
    expect(html).toContain(BACK_LINK);
    expect(page.orderOptions[0]).toMatchObject({ skip: true });
    expect(page.invoiceOptions[0]).toMatchObject({ skip: true });
  });
});

// #166: the Invoice and payment section. Generate and the two payment
// verbs are gated by `laundryOrderActions` only.
describe('order page invoice and payment (#166)', () => {
  // The text of each button in the markup.
  function buttonLabels(html: string): string[] {
    return [...html.matchAll(/<button\b[^>]*>(.*?)<\/button>/g)].map((match) => match[1]!);
  }

  const INVOICE = {
    id: 'i1',
    amountDueMinorUnits: 45000,
    invoiceNumber: 'INV-0001',
    paymentStatus: 'UNPAID',
    paymentTerms: 'PAY_NOW',
    totalMinorUnits: 45000,
  };

  it('case 1: FINANCE sees Generate invoice on PRICED', async () => {
    page.order = order({ status: 'PRICED' });
    page.role = 'FINANCE';
    const invoice = section(await renderPage(), 'invoice');
    expect(buttonLabels(invoice)).toContain('Generate invoice');
    expect(invoice).toContain('Pay on completion');
  });

  it('case 2: SCHEDULER sees neither Generate nor payment buttons on PRICED', async () => {
    page.order = order({ status: 'PRICED' });
    page.role = 'SCHEDULER';
    const invoice = section(await renderPage(), 'invoice');
    expect(buttonLabels(invoice)).toEqual([]);
    expect(invoice).toContain('No invoice yet.');
  });

  it('case 3: OPS_MANAGER sees Mark paid and not Generate on PRICED', async () => {
    page.order = order({ status: 'PRICED' });
    page.role = 'OPS_MANAGER';
    const invoice = section(await renderPage(), 'invoice');
    expect(buttonLabels(invoice)).toEqual(['Mark paid', 'Mark awaiting payment']);
    expect(invoice).not.toContain('Generate invoice');
  });

  it('case 4: RECEIVED offers neither generate nor mark paid', async () => {
    page.order = order({ status: 'RECEIVED', totalMinorUnits: null, weightGrams: null });
    page.role = 'TENANT_OWNER';
    expect(section(await renderPage(), 'invoice')).not.toContain('<button');
  });

  it('case 5: an existing invoice shows number, formatted amount, terms and the billing href', async () => {
    page.order = order({ status: 'PRICED' });
    page.role = 'TENANT_OWNER';
    page.invoiceNodes = [INVOICE];
    const invoice = section(await renderPage(), 'invoice');
    expect(invoice).toContain('INV-0001');
    expect(invoice).toContain('₱450.00');
    expect(invoice).toContain('>Unpaid<');
    expect(invoice).toContain('Pay now');
    expect(invoice).toContain('href="/app/billing?detail=i1"');
    expect(invoice).not.toContain('Generate invoice');
  });

  it('case 6: AWAITING_PAYMENT offers Mark paid only', async () => {
    page.order = order({ status: 'AWAITING_PAYMENT' });
    page.role = 'CUSTOMER_SUPPORT';
    expect(buttonLabels(section(await renderPage(), 'invoice'))).toEqual(['Mark paid']);
  });

  it('case 7: PAID says processing can start, with no payment button', async () => {
    page.order = order({ status: 'PAID' });
    page.role = 'OPS_MANAGER';
    const invoice = section(await renderPage(), 'invoice');
    expect(invoice).toContain('Paid. Processing can start.');
    expect(buttonLabels(invoice)).not.toContain('Mark paid');
    expect(buttonLabels(invoice)).not.toContain('Mark awaiting payment');
  });

  it('case 8: the role loading offers no buttons in the Invoice section', async () => {
    page.order = order({ status: 'PRICED' });
    page.role = undefined;
    expect(section(await renderPage(), 'invoice')).not.toContain('<button');
  });

  it('case 9: the estimate is not on the invoice card', async () => {
    page.order = order({ status: 'PRICED' });
    expect(section(await renderPage(), 'invoice')).not.toContain('Estimate');
  });

  it('case 10: Actions keeps only the remaining lifecycle verbs, as text', async () => {
    page.order = order({ status: 'PRICED' });
    page.role = 'FINANCE';
    let html = await renderPage();
    expect(section(html, 'actions')).toContain('No further actions for this order.');
    expect(section(html, 'actions')).not.toContain('<button');
    expect(buttonLabels(section(html, 'invoice'))).toEqual(['Generate invoice', 'Mark paid', 'Mark awaiting payment']);

    page.order = order({ status: 'PAID' });
    page.role = 'OPS_MANAGER';
    html = await renderPage();
    const actions = section(html, 'actions');
    expect(actions).toContain('Start processing');
    expect(actions).toContain('Refund order');
    expect(actions).not.toContain('<button');
  });
});
