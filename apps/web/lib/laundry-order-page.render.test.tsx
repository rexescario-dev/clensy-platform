import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The `/app/laundry/[id]` order page (#156), rendered statically.
const ID = '3f2a9c1e-0b7d-4e55-9a10-6c2b8d4e7f01';

type Line = {
  addOnId: string | null;
  createdAt: string;
  id: string;
  pricingSnapshot: {
    amountMinorUnits: number;
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
  role: 'TENANT_OWNER' as string | undefined,
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: page.id }),
  usePathname: () => `/app/laundry/${page.id}`,
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

vi.mock('@clensy/client', () => ({
  useCurrentAdminQuery: () => ({
    data: page.role === undefined ? undefined : { currentAdmin: { role: page.role } },
  }),
  useInvoiceForOrderQuery: (options: { skip?: boolean; variables?: unknown }) => {
    page.invoiceOptions.push(options);
    if (page.invoiceShape !== 'nodes') {
      return { data: page.invoiceShape === 'noData' ? undefined : {}, error: undefined, loading: false };
    }
    return {
      data:
        page.invoiceRetained || (!page.invoiceLoading && !page.invoiceError)
          ? { invoices: { nodes: page.invoiceNodes } }
          : undefined,
      error: page.invoiceError,
      loading: page.invoiceLoading,
    };
  },
  useLaundryOrderQuery: (options: { fetchPolicy?: string; skip?: boolean; variables?: unknown }) => {
    page.orderOptions.push(options);
    if (options.skip) return { data: undefined, error: undefined, loading: false };
    return {
      data:
        page.orderRetained || (!page.orderLoading && !page.orderError) ? { laundryOrder: page.order } : undefined,
      error: page.orderError,
      loading: page.orderLoading,
    };
  },
}));

async function renderPage(): Promise<string> {
  const { default: LaundryOrderPage } = await import('../app/app/laundry/[id]/page');
  return renderToStaticMarkup(<LaundryOrderPage />);
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
  page.role = 'TENANT_OWNER';
});

describe('laundry order page', () => {
  it('loads the order from the URL id, network-only, and its invoice', async () => {
    await renderPage();
    expect(page.orderOptions[0]).toMatchObject({ fetchPolicy: 'network-only', skip: false, variables: { id: ID } });
    expect(page.invoiceOptions[0]).toMatchObject({ skip: false, variables: { laundryOrderId: ID } });
  });

  it('renders the header, back link and no list, drawer or controls', async () => {
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
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<form');
    expect(html).not.toContain('<input');
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
    for (const heading of ['Overview', 'Weighing', 'Services', 'Price', 'Invoice', 'Actions']) {
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
    expect(section(html, 'weighing')).toContain('Not weighed yet.');
    expect(section(html, 'services')).toContain('No services selected yet.');
    expect(section(html, 'price')).toContain('Not priced yet.');
  });

  it('shows the recorded weight, the total and the lines once priced', async () => {
    page.order = order({
      lines: {
        nodes: [
          line('l1', 'PER_KG', 2505, 30000, { pricingSnapshot: { ...line('x', 'PER_KG', 2505, 30000).pricingSnapshot, minimumChargeApplied: true } }),
          line('l2', 'PER_ITEM', 3, 9000, { addOnId: 'a1', serviceId: null }),
          line('l3', 'FLAT', 1, 6000, { addOnId: 'a2', serviceId: null }),
        ],
        pageInfo: { hasNextPage: false },
      },
      status: 'PRICED',
    });
    const html = await renderPage();
    const overview = section(html, 'overview');
    expect(count(overview, '<li')).toBe(3);
    expect(overview).toContain('Base service');
    expect(count(overview, '>Add-on<')).toBe(2);
    expect(overview).toContain('Per kg');
    expect(overview).toContain('>Weight</dt>');
    expect(overview).toContain('2.505 kg');
    expect(overview).toContain('Per item');
    expect(overview).toContain('>Items</dt>');
    expect(overview).toContain('>3</dd>');
    expect(overview).toContain('Flat');
    expect(count(overview, '>Weight</dt>') + count(overview, '>Items</dt>')).toBe(2);
    expect(overview).toContain('₱300.00');
    expect(count(overview, 'Minimum charge applied')).toBe(1);
    expect(overview).not.toContain('More lines are not loaded.');
    expect(section(html, 'weighing')).toContain('Recorded weight');
    expect(section(html, 'weighing')).toContain('2.505 kg');
    expect(section(html, 'services')).toContain('Services are priced. The lines are listed under Overview.');
    expect(section(html, 'price')).toContain('Order total');
    expect(section(html, 'price')).toContain('₱450.00');
  });

  it('warns when more lines exist than were loaded', async () => {
    page.order = order({ lines: { nodes: [line('l1', 'FLAT', 1, 100)], pageInfo: { hasNextPage: true } } });
    const html = await renderPage();
    expect(section(html, 'overview')).toContain('More lines are not loaded.');
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
    expect(count(html, 'text-slate-600 whitespace-nowrap') + count(html, 'whitespace-nowrap text-slate-600')).toBe(5);
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
    expect(actions).toContain('Mark awaiting payment');
    expect(actions).toContain('Mark paid');
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

  it('shows the invoice and marks Actions once an invoice exists', async () => {
    page.order = order({ status: 'PRICED' });
    page.invoiceNodes = [{ id: 'i1', invoiceNumber: 'INV-0001', paymentStatus: 'UNPAID', totalMinorUnits: 45000 }];
    const html = await renderPage();
    const invoice = section(html, 'invoice');
    expect(invoice).toContain('INV-0001');
    expect(invoice).toContain('₱450.00');
    expect(invoice).toContain('Unpaid');
    expect(invoice).not.toContain('>UNPAID<');
    expect(html).toMatch(/<a[^>]*href="#laundry-order-actions"[^>]*aria-current="true"|<a[^>]*aria-current="true"[^>]*href="#laundry-order-actions"/);
  });

  it('says when there is no invoice yet', async () => {
    const html = await renderPage();
    expect(section(html, 'invoice')).toContain('No invoice yet.');
  });

  it('says when the invoice cannot be loaded', async () => {
    page.invoiceError = new Error('network down');
    const html = await renderPage();
    expect(section(html, 'invoice')).toContain('Unable to load the invoice.');
    expect(section(html, 'invoice')).not.toContain('No invoice yet.');
  });

  // M5 review 1: retained "no invoice" data would mark Invoice and say
  // "No invoice yet." if it were read. It is not: the nav falls through to
  // Actions (TENANT_OWNER may mark a PRICED order paid) and the section
  // shows the error.
  it('ignores retained invoice data while the invoice query has failed', async () => {
    page.order = order({ status: 'PRICED' });
    page.invoiceNodes = [];
    page.invoiceRetained = true;
    page.invoiceError = new Error('network down');
    const html = await renderPage();
    expect(html).not.toMatch(/<a[^>]*href="#laundry-order-invoice"[^>]*aria-current="true"/);
    expect(html).toMatch(/<a[^>]*href="#laundry-order-actions"[^>]*aria-current="true"/);
    expect(section(html, 'invoice')).toContain('Unable to load the invoice.');
    expect(section(html, 'invoice')).not.toContain('No invoice yet.');
  });

  it('ignores retained invoice data while the invoice query reloads', async () => {
    page.order = order({ status: 'PRICED' });
    page.invoiceNodes = [];
    page.invoiceRetained = true;
    page.invoiceLoading = true;
    const html = await renderPage();
    expect(html).not.toMatch(/<a[^>]*href="#laundry-order-invoice"[^>]*aria-current="true"/);
    expect(html).toMatch(/<a[^>]*href="#laundry-order-actions"[^>]*aria-current="true"/);
    expect(section(html, 'invoice')).not.toContain('No invoice yet.');
    expect(section(html, 'invoice')).not.toContain('Unable to load the invoice.');
  });

  // M5 review 3: only a confirmed node list says whether an invoice exists.
  it.each([
    ['with no data', 'noData'],
    ['without the invoice connection', 'noConnection'],
  ] as const)('treats a finished invoice result %s as unresolved', async (_label, shape) => {
    page.order = order({ status: 'PRICED' });
    page.invoiceShape = shape;
    const html = await renderPage();
    expect(html).not.toMatch(/<a[^>]*href="#laundry-order-invoice"[^>]*aria-current="true"/);
    expect(html).toMatch(/<a[^>]*href="#laundry-order-actions"[^>]*aria-current="true"/);
    expect(section(html, 'invoice')).not.toContain('No invoice yet.');
    expect(section(html, 'invoice')).not.toContain('Unable to load the invoice.');
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
