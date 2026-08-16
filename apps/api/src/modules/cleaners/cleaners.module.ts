import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../../platform/audit/audit.module';
import { TeamsService } from './application/services/teams.service';
import { TeamEntity } from './infrastructure/persistence/team.entity';

// Imports `AuditModule` directly (mirroring `customers.module.ts`'s
// precedent exactly, per the review that fixed `customers.module.ts`'s
// original omission) so `AUDIT_LOGGER` is DI-visible to `TeamsService`:
// Nest module encapsulation means a token exported by `AuditModule` is only
// visible to a module that itself imports `AuditModule` — sibling modules
// imported side-by-side into a shared parent do NOT share DI visibility
// with each other. `AuditModule` is not `@Global()`, so there is no
// ambient mechanism that makes this import optional.
//
// Task 2 extends this with `CleanerEntity`/`CleanersService`.
@Module({
  imports: [TypeOrmModule.forFeature([TeamEntity]), AuditModule],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class CleanersModule {}
