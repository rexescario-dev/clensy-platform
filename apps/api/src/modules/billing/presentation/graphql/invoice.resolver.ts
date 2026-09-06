import { UseGuards } from '@nestjs/common';
import {
  Args,
  ID,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { CurrentUser } from '../../../../platform/auth/decorators/current-user.decorator';
import { Roles } from '../../../../platform/auth/decorators/roles.decorator';
import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { InvoicesService } from '../../application/services/invoices.service';
import { GenerateInvoiceFromOrderInput } from './generate-invoice-from-order.input';
import { toInvoiceType } from './mappers';
import { InvoiceType, VIEW_ROLES } from './invoice.type';

// The custom nullable `invoice(id)` query + the single billing mutation
// `generateInvoiceFromOrder` (spec §4.7). `generateInvoiceFromOrder` is
// gated to FINANCE or OWNER — no other writer role. `amountDueMinorUnits`
// is a computed resolve-field here (never a stored column).
@Resolver(() => InvoiceType)
export class InvoiceResolver {
  constructor(private readonly service: InvoicesService) {}

  @Query(() => InvoiceType, { name: 'invoice', nullable: true })
  @UseGuards(AuthGuard)
  @Roles(...VIEW_ROLES)
  async invoice(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<InvoiceType | null> {
    const invoice = await this.service.getInvoice(id);
    return invoice ? toInvoiceType(invoice) : null;
  }

  @Mutation(() => InvoiceType)
  @UseGuards(AuthGuard)
  @Roles(Role.FINANCE, Role.OWNER)
  async generateInvoiceFromOrder(
    @Args('input') input: GenerateInvoiceFromOrderInput,
    @CurrentUser() user: AuthenticatedPrincipal,
  ): Promise<InvoiceType> {
    return toInvoiceType(
      await this.service.generateFromOrder({ ...input, actorId: user.id }),
    );
  }

  @ResolveField(() => Int)
  amountDueMinorUnits(
    @Parent()
    invoice: Pick<InvoiceType, 'totalMinorUnits' | 'amountPaidMinorUnits'>,
  ): number {
    return invoice.totalMinorUnits - invoice.amountPaidMinorUnits;
  }
}
