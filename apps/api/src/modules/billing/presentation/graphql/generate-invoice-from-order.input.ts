import { Field, ID, InputType } from '@nestjs/graphql';
import { InvoicePaymentTerms } from '../../domain/invoice-payment-terms';

// Input for the single billing mutation (spec §4.7). `paymentTerms` is a
// required GraphQL enum — an out-of-range value is rejected by GraphQL
// validation before the service runs.
@InputType()
export class GenerateInvoiceFromOrderInput {
  @Field(() => ID)
  laundryOrderId!: string;

  @Field(() => InvoicePaymentTerms)
  paymentTerms!: InvoicePaymentTerms;
}
