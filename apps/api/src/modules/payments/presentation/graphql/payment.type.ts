import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import {
  Authorize,
  FilterableField,
  IDField,
} from '@ptc-org/nestjs-query-graphql';
import { tenantReadAuthorizer } from '../../../../platform/auth/authorization/tenant-read.authorizer';
import { PaymentMethod } from '../../domain/payment-method';
import { PaymentRecordStatus } from '../../domain/payment-record-status';
import { PaymentType } from '../../domain/payment-type';

registerEnumType(PaymentType, { name: 'PaymentType' });
registerEnumType(PaymentMethod, { name: 'PaymentMethod' });
registerEnumType(PaymentRecordStatus, { name: 'PaymentRecordStatus' });

// One recorded money movement against an invoice (#39 spec §4.7). Read-only:
// reached only through `Invoice.payments` and the two mutations' returns —
// no read resolver and no root query (planning decision e). `tenantId` and
// `idempotencyKey` are deliberately not fields; staff identity is only the
// opaque `recordedByStaffId`. `invoice` / `refundableMinorUnits` are
// `@ResolveField`s on `PaymentResolver`.
//
// The tenant-read authorizer re-applies the tenant predicate to the nested
// connection (multi-tenant RFC §4.2 relation-field rule). This file never
// imports `invoice.type.ts`: `Relatable(InvoiceType)` evaluates the
// `Invoice.payments` type thunk eagerly, so this class must be fully
// defined first (planning decision l).
//
// `paidAt` / `createdAt` are `@FilterableField` so they are members of the
// generated `PaymentSortFields` enum the nested connection's default sort
// references.
@Authorize(tenantReadAuthorizer<PaymentObjectType>())
@ObjectType('Payment')
export class PaymentObjectType {
  @IDField(() => ID)
  id!: string;

  @FilterableField(() => ID)
  invoiceId!: string;

  @Field(() => PaymentType)
  type!: PaymentType;

  @Field(() => PaymentMethod)
  method!: PaymentMethod;

  @Field(() => Int)
  amountMinorUnits!: number;

  @Field(() => String, { nullable: true })
  reference!: string | null;

  @Field(() => PaymentRecordStatus)
  status!: PaymentRecordStatus;

  @FilterableField()
  paidAt!: Date;

  @Field(() => ID, { nullable: true })
  refundedPaymentId!: string | null;

  @Field(() => ID, { nullable: true })
  recordedByStaffId!: string | null;

  @FilterableField()
  createdAt!: Date;
}
