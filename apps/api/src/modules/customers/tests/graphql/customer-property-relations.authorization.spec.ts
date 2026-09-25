// @ptc-org/nestjs-query-graphql 9.5.0 does not re-export getRelations from
// the package root, so this deep import is required.
import { getRelations } from '@ptc-org/nestjs-query-graphql/src/decorators';
import { BookingDTO } from '../../../bookings/presentation/graphql/booking.dto';
import { InvoiceType } from '../../../billing/presentation/graphql/invoice.type';
import { LaundryOrderType } from '../../../laundry/presentation/graphql/laundry-order.type';
import { CustomerType } from '../../presentation/graphql/customer.type';
import { PropertyType } from '../../presentation/graphql/property.type';

// Kept in its own file: importing the Billing/Laundry GraphQL types registers
// their object types globally, which would leak into the schema builds of the
// Customer/Property resolver specs.
describe('Relations targeting Customer/Property (tenant isolation, #82)', () => {
  // Relation regression guard (task brief Step 0/2). nestjs-query gives a
  // relation's own `auth` precedence over the target DTO's `@Authorize`, so
  // an `auth` on any of these would silently bypass the tenant predicate.
  // Relation `update`/`remove` must stay disabled: `@Authorize` is relied on
  // for reads only (writes are the custom service-backed resolvers).
  it('no relation targeting Customer/Property overrides auth or enables relation mutations', () => {
    const owners = [
      ['Booking', BookingDTO],
      ['Invoice', InvoiceType],
      ['LaundryOrder', LaundryOrderType],
      ['Customer', CustomerType],
    ] as const;
    const targets: unknown[] = [CustomerType, PropertyType];
    const found: string[] = [];
    for (const [ownerName, owner] of owners) {
      const { many = {}, one = {} } = getRelations(owner as never);
      for (const [relationName, relation] of Object.entries({
        ...many,
        ...one,
      })) {
        if (!targets.includes(relation.DTO)) continue;
        found.push(`${ownerName}.${relationName}`);
        expect(relation.auth).toBeUndefined();
        expect(relation.update?.enabled).toBe(false);
        expect(relation.remove?.enabled).toBe(false);
      }
    }
    expect(found.sort()).toEqual(
      [
        'Booking.customer',
        'Booking.property',
        'Customer.properties',
        'Invoice.customer',
        'LaundryOrder.customer',
      ].sort(),
    );
  });
});
