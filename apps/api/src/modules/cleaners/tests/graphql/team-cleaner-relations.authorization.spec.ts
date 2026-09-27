// @ptc-org/nestjs-query-graphql 9.5.0 does not re-export getRelations from
// the package root, so this deep import is required.
import { getRelations } from '@ptc-org/nestjs-query-graphql/src/decorators';
import { BookingDTO } from '../../../bookings/presentation/graphql/booking.dto';
import { CleaningJobType } from '../../../jobs/presentation/graphql/cleaning-job.type';
import { CleanerType } from '../../presentation/graphql/cleaner.type';
import { TeamType } from '../../presentation/graphql/team.type';

// Kept in its own file: importing the Bookings/Jobs GraphQL types registers
// their object types globally, which would leak into the schema builds of
// the Team/Cleaner resolver specs.
describe('Relations targeting Team/Cleaner (tenant isolation, #83)', () => {
  // Relation regression guard (task brief, global constraints). nestjs-query
  // gives a relation's own `auth` precedence over the target DTO's
  // `@Authorize`, so an `auth` on any of these would silently bypass the
  // tenant predicate. Relation `update`/`remove` must stay disabled:
  // `@Authorize` is relied on for reads only (writes are the custom
  // service-backed resolvers).
  it('no relation targeting Team/Cleaner overrides auth or enables relation mutations', () => {
    const owners = [
      ['Booking', BookingDTO],
      ['CleaningJob', CleaningJobType],
      ['Team', TeamType],
      ['Cleaner', CleanerType],
    ] as const;
    const targets: unknown[] = [TeamType, CleanerType];
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
    expect(found.sort()).toEqual(['Booking.team', 'Team.cleaners'].sort());
  });
});
