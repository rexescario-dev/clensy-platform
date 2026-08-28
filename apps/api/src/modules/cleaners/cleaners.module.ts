import { NestjsQueryGraphQLModule } from '@ptc-org/nestjs-query-graphql';
import { NestjsQueryTypeOrmModule } from '@ptc-org/nestjs-query-typeorm';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../../platform/audit/audit.module';
import { CleanersService } from './application/services/cleaners.service';
import { TeamsService } from './application/services/teams.service';
import { CleanerEntity } from './infrastructure/persistence/cleaner.entity';
import { TeamEntity } from './infrastructure/persistence/team.entity';
import { CleanerTeamLoaders } from './presentation/graphql/cleaner-team.loaders';
import { CleanerReadResolver } from './presentation/graphql/cleaner-read.resolver';
import { CleanerResolver } from './presentation/graphql/cleaner.resolver';
import { CleanerType } from './presentation/graphql/cleaner.type';
import { TeamReadResolver } from './presentation/graphql/team-read.resolver';
import { TeamResolver } from './presentation/graphql/team.resolver';
import { TeamType } from './presentation/graphql/team.type';

@Module({
  imports: [
    TypeOrmModule.forFeature([TeamEntity, CleanerEntity]),
    NestjsQueryTypeOrmModule.forFeature([TeamEntity, CleanerEntity]),
    NestjsQueryGraphQLModule.forFeature({
      dtos: [{ DTOClass: CleanerType }, { DTOClass: TeamType }],
    }),
    AuditModule,
  ],
  providers: [
    TeamsService,
    CleanersService,
    CleanerResolver,
    CleanerReadResolver,
    TeamResolver,
    TeamReadResolver,
    CleanerTeamLoaders,
  ],
  exports: [TeamsService, CleanersService],
})
export class CleanersModule {}
