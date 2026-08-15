import { InputType, PartialType } from '@nestjs/graphql';
import { CreatePropertyInput } from './create-property.input';

// No additions, and crucially no `customerId` field (spec §4.2): `customerId`
// is immutable after creation and can only be set via `createProperty`. `id`
// is a separate mutation argument (`updateProperty(id: ID!, input:
// UpdatePropertyInput!)`), never embedded in this input.
@InputType()
export class UpdatePropertyInput extends PartialType(CreatePropertyInput) {}
