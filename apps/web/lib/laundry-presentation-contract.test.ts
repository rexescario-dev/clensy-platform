import type {
  InvoicePaymentStatus,
  InvoicePaymentTerms,
  LaundryFulfillmentType as ClientFulfillmentType,
  LaundryOrderStatus as ClientStatus,
  Role,
} from '@clensy/client';
import {
  LAUNDRY_ORDER_STATUSES,
  type AdminRole,
  type ClensyMessages,
  type LaundryFulfillmentType,
  type LaundryOrderStatus,
} from '@clensy/web';
import { describe, expect, expectTypeOf, it } from 'vitest';

type LaundryMessages = ClensyMessages['laundry'];

describe('laundry presentation contract with the generated client', () => {
  it('uses exactly the generated status, fulfillment and role unions', () => {
    expectTypeOf<LaundryOrderStatus>().toEqualTypeOf<ClientStatus>();
    expectTypeOf<LaundryFulfillmentType>().toEqualTypeOf<ClientFulfillmentType>();
    expectTypeOf<AdminRole>().toEqualTypeOf<Role>();
  });

  it('lists every generated status once and labels every status, fulfillment and invoice enum value', () => {
    const everyStatus: Record<ClientStatus, true> = {
      AWAITING_DELIVERY: true,
      AWAITING_PAYMENT: true,
      AWAITING_PICKUP: true,
      CANCELLED: true,
      COMPLETED: true,
      DAMAGED: true,
      LOST: true,
      PAID: true,
      PRICED: true,
      PROCESSING: true,
      READY: true,
      RECEIVED: true,
      REFUNDED: true,
      REJECTED: true,
      WEIGHED: true,
    };
    expect([...LAUNDRY_ORDER_STATUSES].sort()).toEqual(Object.keys(everyStatus).sort());
    expectTypeOf<keyof LaundryMessages['invoicePaymentStatus']>().toEqualTypeOf<InvoicePaymentStatus>();
    expectTypeOf<keyof LaundryMessages['paymentTerms']>().toEqualTypeOf<InvoicePaymentTerms>();
    expectTypeOf<keyof LaundryMessages['status']>().toEqualTypeOf<ClientStatus>();
    expectTypeOf<keyof LaundryMessages['fulfillment']>().toEqualTypeOf<ClientFulfillmentType>();
  });
});
