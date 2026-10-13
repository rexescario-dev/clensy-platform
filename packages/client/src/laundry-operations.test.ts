import { print, visit, type DocumentNode } from 'graphql';
import { describe, expect, it } from 'vitest';
import { LaundryOrderDocument } from './generated/graphql';

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

describe('laundry operations', () => {
  // A laundry order is one base service plus its add-ons. The server's
  // nested default page is 20 and its maximum is PLATFORM_PAGE_MAX (100),
  // so the order page asks for 100 and warns past that (#156).
  it('requests up to 100 lines on the order detail query', () => {
    expect(linesArguments(LaundryOrderDocument)).toEqual(['paging: { limit: 100 }']);
  });
});
