// TEST-ONLY deep import, tied to the installed @ptc-org/nestjs-query-graphql
// 9.5.0 package layout (it does not re-export getRelations from the package
// root). Same pattern as #82-#86.
import { getRelations } from '@ptc-org/nestjs-query-graphql/src/decorators';
import { CustomerType } from '../../../customers/presentation/graphql/customer.type';
import { LaundryOrderLineType } from '../../../laundry/presentation/graphql/laundry-order-line.type';
import { LaundryOrderType } from '../../../laundry/presentation/graphql/laundry-order.type';
import { InvoiceLineType } from '../../presentation/graphql/invoice-line.type';
import { InvoiceType } from '../../presentation/graphql/invoice.type';

// Kept in its own file: importing other modules' GraphQL types registers
// them globally.
//
// #87 Slice decision 5 / Global constraints. nestjs-query gives a
// relation's own `auth` precedence over the target DTO's `@Authorize`, so an
// `auth` on any relation into a laundry/invoice type would bypass the tenant
// predicate. Planning-time inventory: Invoice.laundryOrder (defers to
// LaundryOrderType's authorizer), LaundryOrder.lines and Invoice.lines
// (owned via their authorized parent, slice decision 2). A regression guard
// on relation configuration, not proof of isolation — that is the
// two-tenant e2e (Task 6).
describe('Relations targeting laundry / invoice types (tenant isolation, #87)', () => {
  it('matches the inventory, overrides no auth, and enables no relation mutations', () => {
    const targets = new Set<unknown>([
      LaundryOrderType,
      LaundryOrderLineType,
      InvoiceType,
      InvoiceLineType,
    ]);
    const owners = [
      ['LaundryOrder', LaundryOrderType],
      ['LaundryOrderLine', LaundryOrderLineType],
      ['Invoice', InvoiceType],
      ['InvoiceLine', InvoiceLineType],
      ['Customer', CustomerType],
    ] as const;
    const found: string[] = [];
    for (const [ownerName, owner] of owners) {
      const { many = {}, one = {} } = getRelations(owner as never);
      for (const [relationName, relation] of Object.entries({
        ...many,
        ...one,
      })) {
        if (!targets.has(relation.DTO)) continue;
        found.push(`${ownerName}.${relationName}`);
        expect(relation.auth).toBeUndefined();
        expect(relation.update?.enabled).toBe(false);
        expect(relation.remove?.enabled).toBe(false);
      }
    }
    expect(found.sort()).toEqual([
      'Invoice.laundryOrder',
      'Invoice.lines',
      'LaundryOrder.lines',
    ]);
  });

  it('customer relations keep deferring to CustomerType’s authorizer', () => {
    expect(
      getRelations(InvoiceType as never).one?.customer.auth,
    ).toBeUndefined();
    expect(
      getRelations(LaundryOrderType as never).one?.customer.auth,
    ).toBeUndefined();
  });
});
