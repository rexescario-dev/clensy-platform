// @ptc-org/nestjs-query-graphql 9.5.0 does not re-export getRelations from
// the package root, so this deep import is required.
import { getRelations } from '@ptc-org/nestjs-query-graphql/src/decorators';
import { BookingDTO } from '../../../bookings/presentation/graphql/booking.dto';
import { AddOnType } from '../../presentation/graphql/add-on.type';
import { ServiceType } from '../../presentation/graphql/service.type';

// Kept in its own file: importing the Bookings GraphQL types registers their
// object types globally, which would leak into the catalog resolver specs.
describe('Relations targeting Service/AddOn (tenant isolation, #84)', () => {
  // nestjs-query gives a relation's own `auth` precedence over the target
  // DTO's `@Authorize`, so an `auth` on any of these would silently bypass
  // the tenant predicate. Relation `update`/`remove` must stay disabled:
  // `@Authorize` is relied on for reads only.
  it('no relation targeting Service/AddOn overrides auth or enables relation mutations', () => {
    const owners = [
      ['Booking', BookingDTO],
      ['Service', ServiceType],
      ['AddOn', AddOnType],
    ] as const;
    const targets: unknown[] = [ServiceType, AddOnType];
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
    expect(found).toEqual(['Booking.service']);
  });
});
