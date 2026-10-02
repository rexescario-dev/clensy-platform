// Root-operation inventory shared by #90's metadata guard
// (`root-operation-authorization.e2e-spec.ts`) and #92's two-tenant release
// gate (one inventory source). Every root (operation, field) must be
// classified here; a new field fails both suites until someone decides its
// class.
export type RootClass = 'AUTHENTICATED' | 'PUBLIC' | 'TENANT';

// PUBLIC: RFC §4.2 (only login/logout). AUTHENTICATED: any role
// (Admin Foundation §4.9). TENANT: tenant business and tenant staff
// administration — 21 queries and 38 mutations. Keys sorted (lint).
export const ROOT_OPERATION_CLASSIFICATION: Readonly<
  Record<string, RootClass>
> = {
  'Mutation.assignCleanerToTeam': 'TENANT',
  'Mutation.assignTeamToJob': 'TENANT',
  'Mutation.cancelLaundryOrder': 'TENANT',
  'Mutation.completeChecklistItem': 'TENANT',
  'Mutation.completeJob': 'TENANT',
  'Mutation.completeLaundryOrder': 'TENANT',
  'Mutation.createAddOn': 'TENANT',
  'Mutation.createAdmin': 'TENANT',
  'Mutation.createBooking': 'TENANT',
  'Mutation.createCleaner': 'TENANT',
  'Mutation.createCustomer': 'TENANT',
  'Mutation.createJobFromBooking': 'TENANT',
  'Mutation.createPricingRule': 'TENANT',
  'Mutation.createProperty': 'TENANT',
  'Mutation.createService': 'TENANT',
  'Mutation.createTeam': 'TENANT',
  'Mutation.disableAdmin': 'TENANT',
  'Mutation.generateInvoiceFromOrder': 'TENANT',
  'Mutation.login': 'PUBLIC',
  'Mutation.logout': 'PUBLIC',
  'Mutation.markLaundryOrderAwaitingDelivery': 'TENANT',
  'Mutation.markLaundryOrderAwaitingPayment': 'TENANT',
  'Mutation.markLaundryOrderAwaitingPickup': 'TENANT',
  'Mutation.markLaundryOrderDamaged': 'TENANT',
  'Mutation.markLaundryOrderLost': 'TENANT',
  'Mutation.markLaundryOrderPaid': 'TENANT',
  'Mutation.markLaundryOrderReady': 'TENANT',
  'Mutation.priceLaundryOrder': 'TENANT',
  'Mutation.receiveLaundryOrder': 'TENANT',
  'Mutation.refundLaundryOrder': 'TENANT',
  'Mutation.rejectLaundryOrder': 'TENANT',
  'Mutation.removeBooking': 'TENANT',
  'Mutation.startLaundryProcessing': 'TENANT',
  'Mutation.updateAddOn': 'TENANT',
  'Mutation.updateBooking': 'TENANT',
  'Mutation.updateCleaner': 'TENANT',
  'Mutation.updateCustomer': 'TENANT',
  'Mutation.updateProperty': 'TENANT',
  'Mutation.updateService': 'TENANT',
  'Mutation.weighLaundryOrder': 'TENANT',
  'Query.activePricing': 'TENANT',
  'Query.addOns': 'TENANT',
  'Query.admins': 'TENANT',
  'Query.booking': 'TENANT',
  'Query.bookings': 'TENANT',
  'Query.cleaner': 'TENANT',
  'Query.cleaners': 'TENANT',
  'Query.currentAdmin': 'AUTHENTICATED',
  'Query.customer': 'TENANT',
  'Query.customerProperties': 'TENANT',
  'Query.customers': 'TENANT',
  'Query.invoice': 'TENANT',
  'Query.invoices': 'TENANT',
  'Query.job': 'TENANT',
  'Query.jobs': 'TENANT',
  'Query.laundryOrder': 'TENANT',
  'Query.laundryOrders': 'TENANT',
  'Query.property': 'TENANT',
  'Query.service': 'TENANT',
  'Query.services': 'TENANT',
  'Query.team': 'TENANT',
  'Query.teams': 'TENANT',
};

export function rootOperationKey(operation: string, field: string): string {
  return `${operation}.${field}`;
}

export function tenantRootOperationKeys(): string[] {
  return Object.entries(ROOT_OPERATION_CLASSIFICATION)
    .filter(([, rootClass]) => rootClass === 'TENANT')
    .map(([key]) => key)
    .sort();
}
