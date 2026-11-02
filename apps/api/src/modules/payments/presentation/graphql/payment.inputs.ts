import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsDate, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { PaymentMethod } from '../../domain/payment-method';

// Inputs for the two payment mutations (#39 spec §4.7). Type-shape
// decorators only (planning decision c): every value check — UUID key,
// amount range, reference length, paid-at not in the future — is
// `PaymentsService`'s ordered A1–A4 sequence, so the first failure stays
// the spec's. No `paymentStatus` / `amountPaidMinorUnits`: the derived pair
// is never client-settable.
@InputType()
export class RecordInvoicePaymentInput {
  @Field(() => ID)
  @IsString()
  invoiceId!: string;

  @Field(() => ID)
  @IsString()
  idempotencyKey!: string;

  @Field(() => PaymentMethod)
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @Field(() => Int)
  @IsInt()
  amountMinorUnits!: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  reference?: string | null;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @IsDate()
  paidAt?: Date | null;
}

// The invoice is the original payment's; the caller does not name it.
@InputType()
export class RefundInvoicePaymentInput {
  @Field(() => ID)
  @IsString()
  paymentId!: string;

  @Field(() => ID)
  @IsString()
  idempotencyKey!: string;

  @Field(() => PaymentMethod)
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @Field(() => Int)
  @IsInt()
  amountMinorUnits!: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  reference?: string | null;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @IsDate()
  paidAt?: Date | null;
}
