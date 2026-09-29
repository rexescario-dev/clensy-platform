// TEST-ONLY deep import, tied to the installed @ptc-org/nestjs-query-graphql
// 9.5.0 package layout (it does not re-export getRelations from the package
// root). Not an application dependency; on a nestjs-query upgrade, fix this
// path first if the spec fails to compile. Same pattern as #82-#85.
import { getRelations } from '@ptc-org/nestjs-query-graphql/src/decorators';
import { BookingDTO } from '../../../bookings/presentation/graphql/booking.dto';
import { PropertyType } from '../../../customers/presentation/graphql/property.type';
import { ChecklistItemType } from '../../presentation/graphql/checklist-item.type';
import { ChecklistType } from '../../presentation/graphql/checklist.type';
import { CleaningJobType } from '../../presentation/graphql/cleaning-job.type';

// Kept in its own file: importing other modules' GraphQL types registers
// their object types globally, which would leak into the job resolver
// specs.
//
// #86 Slice decision 5 / Global constraints. nestjs-query gives a
// relation's own `auth` precedence over the target DTO's `@Authorize`, so an
// `auth` on any relation into a job/checklist type would bypass the tenant
// predicate. Planning-time inventory: nothing targets CleaningJob or
// Checklist; only Checklist.items targets ChecklistItem (owned via its
// Checklist, Slice decision 2).
describe('Relations targeting CleaningJob / Checklist / ChecklistItem (tenant isolation, #86)', () => {
  it('matches the inventory, overrides no auth, and enables no relation mutations', () => {
    const targets = new Set<unknown>([
      CleaningJobType,
      ChecklistType,
      ChecklistItemType,
    ]);
    const owners = [
      ['CleaningJob', CleaningJobType],
      ['Checklist', ChecklistType],
      ['ChecklistItem', ChecklistItemType],
      ['Booking', BookingDTO],
      ['Property', PropertyType],
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
    expect(found.sort()).toEqual(['Checklist.items']);
  });

  it('CleaningJob.booking keeps deferring to BookingDTO’s authorizer', () => {
    const { one = {} } = getRelations(CleaningJobType as never);
    expect(one.booking.DTO).toBe(BookingDTO);
    expect(one.booking.auth).toBeUndefined();
  });
});
