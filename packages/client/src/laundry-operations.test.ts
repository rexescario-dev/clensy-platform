import { print, visit, type DocumentNode } from 'graphql';
import { describe, expect, it } from 'vitest';
import { InvoiceForOrderDocument, LaundryOrderDocument, PreviewLaundryOrderPriceDocument } from './generated/graphql';

// The arguments of every `lines` field in a document, printed.
function linesArguments(document: DocumentNode): string[] {
  const found: string[] = [];
  visit(document, {
    Field(node) {
      if (node.name.value === 'lines') {
        found.push((node.arguments ?? []).map((argument) => print(argument)).join(', '));
      }
    },
  });
  return found;
}

// The field names selected directly under every `name` field in a document.
function selectionsUnder(document: DocumentNode, name: string): string[][] {
  const found: string[][] = [];
  visit(document, {
    Field(node) {
      if (node.name.value === name) {
        found.push(
          (node.selectionSet?.selections ?? []).map((selection) =>
            selection.kind === 'Field' ? selection.name.value : selection.kind,
          ),
        );
      }
    },
  });
  return found;
}

describe('laundry operations', () => {
  // A laundry order is one base service plus its add-ons. The server's
  // nested default page is 20 and its maximum is PLATFORM_PAGE_MAX (100),
  // so the order page asks for 100 and warns past that (#156).
  it('requests up to 100 lines on the order detail query', () => {
    expect(linesArguments(LaundryOrderDocument)).toEqual(['paging: { limit: 100 }']);
  });

  // #159 (Amendment #164 §8.4.2): the frozen catalog name on every priced line.
  it('selects the frozen description on every priced line', () => {
    const snapshots = selectionsUnder(LaundryOrderDocument, 'pricingSnapshot');
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toContain('description');
  });

  // #159 (Amendment #164 §8.4.5): the estimate is a read, with every field a
  // line shows.
  it('previews price as a query with every estimate field', () => {
    const operations = PreviewLaundryOrderPriceDocument.definitions.filter(
      (definition) => definition.kind === 'OperationDefinition',
    );
    expect(operations.map((operation) => operation.operation)).toEqual(['query']);
    expect(selectionsUnder(PreviewLaundryOrderPriceDocument, 'previewLaundryOrderPrice')).toEqual([
      ['estimatedTotalMinorUnits', 'lines'],
    ]);
    expect(selectionsUnder(PreviewLaundryOrderPriceDocument, 'lines')).toEqual([
      [
        'serviceId',
        'addOnId',
        'description',
        'unit',
        'quantity',
        'rateMinorUnits',
        'amountMinorUnits',
        'minimumChargeMinorUnits',
        'minimumChargeApplied',
      ],
    ]);
  });

  // #166: the order page's Invoice card shows terms; one invoice per order
  // (uq_invoice_laundry_order), so the query needs no sort.
  it('requests the invoice card fields for the order invoice', () => {
    expect(selectionsUnder(InvoiceForOrderDocument, 'nodes')).toEqual([
      ['id', 'invoiceNumber', 'totalMinorUnits', 'amountDueMinorUnits', 'paymentStatus', 'paymentTerms'],
    ]);
  });
});
