import { InputType, PartialType } from '@nestjs/graphql';
import { CreateCleanerInput } from './create-cleaner.input';

// No additions (spec §4.2/§4.5) — `id` is a separate mutation argument
// (`updateCleaner(id: ID!, input: UpdateCleanerInput!)`), never embedded in
// this input. No `teamId` here either — team assignment goes exclusively
// through the dedicated `assignCleanerToTeam` mutation.
@InputType()
export class UpdateCleanerInput extends PartialType(CreateCleanerInput) {}
