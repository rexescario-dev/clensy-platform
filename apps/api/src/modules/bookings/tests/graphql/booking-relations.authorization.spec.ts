// TEST-ONLY deep import, tied to the installed @ptc-org/nestjs-query-graphql
// 9.5.0 package layout (it does not re-export getRelations from the package
// root). Not an application dependency; on a nestjs-query upgrade, fix this
// path first if the spec fails to compile. Same pattern as #82-#84.
import { getRelations } from '@ptc-org/nestjs-query-graphql/src/decorators';
import { PropertyType } from '../../../customers/presentation/graphql/property.type';
import { CleaningJobType } from '../../../jobs/presentation/graphql/cleaning-job.type';
import { BookingDTO } from '../../presentation/graphql/booking.dto';

// Kept in its own file: importing other modules' GraphQL types registers
// their object types globally, which would leak into the booking resolver
// specs.
describe('Relations targeting Booking (tenant isolation, #85)', () => {
  // nestjs-query gives a relation's own `auth` precedence over the target
  // DTO's `@Authorize`, so an `auth` on any of these would silently bypass
  // the tenant predicate. Relation `update`/`remove` must stay disabled:
  // `@Authorize` is relied on for reads only. The planning-time inventory
  // is exactly two cross-type relations (Global constraints); `BookingDTO`
  // itself is also scanned so a future self-relation cannot slip past.
  it('no relation targeting Booking overrides auth or enables relation mutations', () => {
    const owners = [
      ['Booking', BookingDTO], // self-relations: none today
      ['CleaningJob', CleaningJobType],
      ['Property', PropertyType],
    ] as const;
    const found: string[] = [];
    for (const [ownerName, owner] of owners) {
      const { many = {}, one = {} } = getRelations(owner as never);
      for (const [relationName, relation] of Object.entries({
        ...many,
        ...one,
      })) {
        // `PropertyType` resolves `bookingDto` lazily via `require()`, so
        // `relation.DTO` may be a thunk result rather than the `BookingDTO`
        // class reference itself. Fall back to a name comparison.
        const isBooking =
          relation.DTO === BookingDTO ||
          (relation.DTO as { name?: string } | undefined)?.name ===
            'BookingDTO';
        if (!isBooking) continue;
        found.push(`${ownerName}.${relationName}`);
        expect(relation.auth).toBeUndefined();
        expect(relation.update?.enabled).toBe(false);
        expect(relation.remove?.enabled).toBe(false);
      }
    }
    expect(found.sort()).toEqual(['CleaningJob.booking', 'Property.bookings']);
  });
});
