import { NotFoundException, UseGuards } from '@nestjs/common';
import {
  Args,
  Int,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { requireTenantId } from '../../../../platform/auth/authorization/require-tenant-id';
import { CurrentUser } from '../../../../platform/auth/decorators/current-user.decorator';
import { Roles } from '../../../../platform/auth/decorators/roles.decorator';
import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { InvoicesService } from '../../../billing/application/services/invoices.service';
import { toInvoiceType } from '../../../billing/presentation/graphql/mappers';
import { InvoiceType } from '../../../billing/presentation/graphql/invoice.type';
import { PaymentsService } from '../../application/services/payments.service';
import { PaymentRecordStatus } from '../../domain/payment-record-status';
import { PaymentType } from '../../domain/payment-type';
import { toPaymentObjectType } from './mappers';
import {
  RecordInvoicePaymentInput,
  RefundInvoicePaymentInput,
} from './payment.inputs';
import { PaymentObjectType } from './payment.type';
import { RefundableAmountLoader } from './refundable-amount.loader';

// The two payment mutations and `Payment`'s resolve-fields (#39 spec §4.7).
//
// `AuthGuard` + `@Roles` sit on the two mutation methods only, never on the
// class (planning decision r): a class-level guard would apply to the
// `invoice` / `refundableMinorUnits` relation fields, which are authorized
// by the root operation that reaches them (multi-tenant RFC §4.2), and the
// relation-field guard suite rejects that. Tenant for every read comes from
// the principal, never from the parent row.
@Resolver(() => PaymentObjectType)
export class PaymentResolver {
  constructor(
    private readonly payments: PaymentsService,
    private readonly invoices: InvoicesService,
    private readonly refundableLoader: RefundableAmountLoader,
  ) {}

  // Planning decision e: hand-written, not a nestjs-query relation (that
  // would need a `Payment` read resolver). Non-null: every payment has an
  // invoice in its own tenant (composite FK), so a miss means the caller
  // cannot see it.
  @ResolveField(() => InvoiceType)
  async invoice(
    @Parent() payment: Pick<PaymentObjectType, 'invoiceId'>,
    @CurrentUser() user: AuthenticatedPrincipal | undefined,
  ): Promise<InvoiceType> {
    const invoice = await this.invoices.getInvoice(
      payment.invoiceId,
      user?.tenantId ?? null,
    );
    if (!invoice) {
      throw new NotFoundException(`Invoice ${payment.invoiceId} not found`);
    }
    return toInvoiceType(invoice);
  }

  @Mutation(() => PaymentObjectType)
  @UseGuards(AuthGuard)
  @Roles(
    Role.TENANT_OWNER,
    Role.OPS_MANAGER,
    Role.FINANCE,
    Role.CUSTOMER_SUPPORT,
  )
  async recordInvoicePayment(
    @Args('input') input: RecordInvoicePaymentInput,
    @CurrentUser() user: AuthenticatedPrincipal,
  ): Promise<PaymentObjectType> {
    return toPaymentObjectType(
      await this.payments.record({
        ...input,
        actorId: user.id,
        tenantId: requireTenantId(user),
      }),
    );
  }

  // Spec §3 refundable amount, only for a COMPLETED PAYMENT; batched per
  // tenant per request (planning decision d).
  @ResolveField(() => Int, { nullable: true })
  async refundableMinorUnits(
    @Parent()
    payment: Pick<PaymentObjectType, 'id' | 'status' | 'type'>,
    @CurrentUser() user: AuthenticatedPrincipal | undefined,
  ): Promise<number | null> {
    if (
      payment.type !== PaymentType.PAYMENT ||
      payment.status !== PaymentRecordStatus.COMPLETED
    ) {
      return null;
    }
    return this.refundableLoader
      .loaderFor(user?.tenantId ?? null)
      .load(payment.id);
  }

  @Mutation(() => PaymentObjectType)
  @UseGuards(AuthGuard)
  @Roles(Role.TENANT_OWNER, Role.FINANCE)
  async refundInvoicePayment(
    @Args('input') input: RefundInvoicePaymentInput,
    @CurrentUser() user: AuthenticatedPrincipal,
  ): Promise<PaymentObjectType> {
    return toPaymentObjectType(
      await this.payments.refund({
        ...input,
        actorId: user.id,
        tenantId: requireTenantId(user),
      }),
    );
  }
}
