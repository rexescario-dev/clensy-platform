import { Field, ID, InputType } from '@nestjs/graphql';
import { IsEnum, IsString } from 'class-validator';
import { InvoicePaymentTerms } from '../../domain/invoice-payment-terms';

// Input for the single billing mutation (spec §4.7). `@IsString()` (not
// `@IsUUID()`) on the id — the laundry `LaundryOrderRefInput` convention:
// existence is the server-side `NotFoundException` check's job.
@InputType()
export class GenerateInvoiceFromOrderInput {
  @Field(() => ID)
  @IsString()
  laundryOrderId!: string;

  @Field(() => InvoicePaymentTerms)
  @IsEnum(InvoicePaymentTerms)
  paymentTerms!: InvoicePaymentTerms;
}
