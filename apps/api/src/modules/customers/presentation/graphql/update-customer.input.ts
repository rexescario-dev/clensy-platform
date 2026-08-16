import { InputType, PartialType } from '@nestjs/graphql';
import { CreateCustomerInput } from './create-customer.input';

// No additions (spec §4.2/§4.5) — `id` is a separate mutation argument
// (`updateCustomer(id: ID!, input: UpdateCustomerInput!)`), never embedded
// in this input, unlike `UpdateBookingInput`'s shape.
@InputType()
export class UpdateCustomerInput extends PartialType(CreateCustomerInput) {}
