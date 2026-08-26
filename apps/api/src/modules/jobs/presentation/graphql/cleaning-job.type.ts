import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { BookingType } from '../../../bookings/presentation/graphql/booking.type';
import { TeamType } from '../../../cleaners/presentation/graphql/team.type';
import { JobStatus } from '../../domain/job-status';
import { ChecklistType } from './checklist.type';

registerEnumType(JobStatus, { name: 'JobStatus' });

// No `@Field()` for `bookingId`/`teamId` — GraphQL clients read
// `job.booking.id` / `job.team.id` (spec §4.5). Those ids remain on the
// runtime mapper object for `@ResolveField` to load from.
@ObjectType('CleaningJob')
export class CleaningJobType {
  @Field(() => ID)
  id!: string;

  @Field()
  scheduledAt!: Date;

  @Field(() => JobStatus)
  status!: JobStatus;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field(() => BookingType)
  booking!: BookingType;

  @Field(() => TeamType, { nullable: true })
  team!: TeamType | null;

  @Field(() => ChecklistType)
  checklist!: ChecklistType;
}
