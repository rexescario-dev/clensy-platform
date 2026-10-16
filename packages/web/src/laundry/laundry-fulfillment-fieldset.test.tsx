import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LaundryFulfillmentFieldset } from './laundry-fulfillment-fieldset';

const noop = () => {};

// Static markup, as in the other @clensy/web tests. Clicks are covered by
// apps/web's jsdom page test. The row classes are #160's stated visual
// contract, so they are asserted alongside the radio state.
describe('LaundryFulfillmentFieldset', () => {
  it('explains both options and says the choice is fixed at intake', () => {
    const html = renderToStaticMarkup(<LaundryFulfillmentFieldset name="fulfillment" value="PICKUP" onChange={noop} />);
    expect(html).toContain('<legend');
    expect(html).toContain('>Fulfillment</legend>');
    expect(html).toContain('This choice is fixed at intake.');
    expect(html).toContain('Customer pickup');
    expect(html).toContain('The customer collects the finished laundry.');
    expect(html).toContain('>Delivery<');
    expect(html).toContain('The shop returns the finished laundry. This does not schedule a route.');
  });

  it('uses two real radios in one group, each named by its title and described by its description', () => {
    const html = renderToStaticMarkup(<LaundryFulfillmentFieldset name="fulfillment" value="PICKUP" onChange={noop} />);
    for (const option of ['PICKUP', 'DELIVERY']) {
      const input = new RegExp(`<input[^>]*id="fulfillment-${option}"[^>]*>`).exec(html)?.[0];
      expect(input).toBeDefined();
      expect(input).toContain('type="radio"');
      expect(input).toContain('name="fulfillment"');
      expect(input).toContain(`value="${option}"`);
      expect(input).toContain(`aria-labelledby="fulfillment-${option}-title"`);
      expect(input).toContain(`aria-describedby="fulfillment-${option}-description"`);
      expect(input).not.toContain('aria-invalid');
      expect(html).toContain(`for="fulfillment-${option}"`);
      expect(html).toMatch(new RegExp(`<span id="fulfillment-${option}-title"[^>]*>[^<]+</span>`));
      expect(html).toContain(`id="fulfillment-${option}-description"`);
    }
    expect(html).toMatch(/<fieldset[^>]*aria-describedby="fulfillment-fixed"/);
  });

  it('shows a field error under the radios, marks both invalid and describes each with it after its description', () => {
    const message = 'fulfillmentType must be one of the following values: PICKUP, DELIVERY';
    const html = renderToStaticMarkup(
      <LaundryFulfillmentFieldset name="fulfillment" value="PICKUP" error={message} onChange={noop} />,
    );
    // The group keeps only the helper, so the error is not read twice.
    expect(html).toMatch(/<fieldset[^>]*aria-describedby="fulfillment-fixed"/);
    for (const option of ['PICKUP', 'DELIVERY']) {
      const input = new RegExp(`<input[^>]*id="fulfillment-${option}"[^>]*>`).exec(html)![0];
      expect(input).toContain('aria-invalid="true"');
      expect(input).toContain(`aria-describedby="fulfillment-${option}-description fulfillment-error"`);
    }
    expect(html).toContain(`<p id="fulfillment-error" class="text-sm text-red-600">${message}</p>`);
    expect(html).not.toContain('role="alert"');
    const clean = renderToStaticMarkup(<LaundryFulfillmentFieldset name="fulfillment" value="PICKUP" onChange={noop} />);
    expect(clean).not.toContain('fulfillment-error');
    expect(clean).not.toContain('aria-invalid');
  });

  it('checks the current value and borders the selected row darker', () => {
    const html = renderToStaticMarkup(<LaundryFulfillmentFieldset name="fulfillment" value="DELIVERY" onChange={noop} />);
    expect(/<input[^>]*id="fulfillment-DELIVERY"[^>]*>/.exec(html)?.[0]).toContain('checked=""');
    expect(/<input[^>]*id="fulfillment-PICKUP"[^>]*>/.exec(html)?.[0]).not.toContain('checked');
    expect(/<label[^>]*for="fulfillment-DELIVERY"[^>]*>/.exec(html)?.[0]).toContain('border-slate-900');
    expect(/<label[^>]*for="fulfillment-PICKUP"[^>]*>/.exec(html)?.[0]).toContain('border-slate-300');
    expect(html).toContain('rounded-md border px-3 py-2');
    expect(html).toContain('sm:grid sm:grid-cols-2 sm:gap-3');
  });
});
