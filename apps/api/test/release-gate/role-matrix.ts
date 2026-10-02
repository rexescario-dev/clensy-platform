import { Role } from '../../src/platform/auth/domain/role';

// #92 pinned role matrix (plan decision 6). The independent oracle for
// operation-level RBAC: transcribed from the Accepted specs, with OWNER
// read as TENANT_OWNER (RFC §4.3) and SUPER_ADMIN never allowed (RFC §4.2).
// Phase 2 compares it with live @Roles(); change it only when an Accepted
// authorization spec changes. Specs live in docs/superpowers/specs/.
export interface RoleMatrixEntry {
  allowed: readonly Role[];
  source: string;
}

export const TENANT_ROLES: readonly Role[] = [
  Role.TENANT_OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
  Role.FINANCE,
  Role.ANALYST,
];

export const ALL_ROLES: readonly Role[] = [...TENANT_ROLES, Role.SUPER_ADMIN];

const {
  ANALYST,
  CUSTOMER_SUPPORT,
  FINANCE,
  OPS_MANAGER,
  SCHEDULER,
  TENANT_OWNER,
} = Role;
const RFC = 'RFC 2026-09-23 §4.3 (OWNER→TENANT_OWNER)';

const STAFF_ADMIN: RoleMatrixEntry = {
  allowed: [TENANT_OWNER],
  source: `Admin Foundation §4.5 "Staff account management"; ${RFC} staff lifecycle`,
};
const CUSTOMER_WRITE: RoleMatrixEntry = {
  allowed: [TENANT_OWNER, OPS_MANAGER, CUSTOMER_SUPPORT],
  source: `Customers & Properties §4.3 "Create / update customer"; ${RFC}`,
};
const PROPERTY_WRITE: RoleMatrixEntry = {
  allowed: [TENANT_OWNER, OPS_MANAGER, CUSTOMER_SUPPORT],
  source: `Customers & Properties §4.3 "Create / update property"; ${RFC}`,
};
const CUSTOMER_VIEW: RoleMatrixEntry = {
  allowed: [TENANT_OWNER, OPS_MANAGER, SCHEDULER, CUSTOMER_SUPPORT, ANALYST],
  source: `Customers & Properties §4.3 "View customer / property"; ${RFC}`,
};
const SERVICE_WRITE: RoleMatrixEntry = {
  allowed: [TENANT_OWNER, OPS_MANAGER],
  source: `Catalog §4.3 "Create / update service"; ${RFC}`,
};
const ADD_ON_WRITE: RoleMatrixEntry = {
  allowed: [TENANT_OWNER, OPS_MANAGER],
  source: `Catalog §4.3 "Create / update add-on"; ${RFC}`,
};
const PRICING_RULE_WRITE: RoleMatrixEntry = {
  allowed: [TENANT_OWNER, OPS_MANAGER],
  source: `Catalog §4.3 "Create pricing rule"; Laundry Catalog Foundation §4.5 (unchanged); ${RFC}`,
};
const CATALOG_VIEW: RoleMatrixEntry = {
  allowed: [
    TENANT_OWNER,
    OPS_MANAGER,
    SCHEDULER,
    CUSTOMER_SUPPORT,
    FINANCE,
    ANALYST,
  ],
  source: `Catalog §4.3 "View service / add-on / active pricing"; ${RFC}`,
};
const CLEANER_WRITE: RoleMatrixEntry = {
  allowed: [TENANT_OWNER, OPS_MANAGER],
  source: `Cleaners & Teams §4.3 "Create / update cleaner"; ${RFC}`,
};
const TEAM_WRITE: RoleMatrixEntry = {
  allowed: [TENANT_OWNER, OPS_MANAGER],
  source: `Cleaners & Teams §4.3 "Create team / assign cleaner to team"; ${RFC}`,
};
const WORKFORCE_VIEW: RoleMatrixEntry = {
  allowed: [TENANT_OWNER, OPS_MANAGER, SCHEDULER, ANALYST],
  source: `Cleaners & Teams §4.3 "View cleaner / team"; ${RFC}`,
};
const BOOKING_WRITE: RoleMatrixEntry = {
  allowed: [TENANT_OWNER, OPS_MANAGER, SCHEDULER, CUSTOMER_SUPPORT],
  source: `Bookings §4.3 "Create / update / cancel / delete booking" (GraphQL); ${RFC}`,
};
const BOOKING_VIEW: RoleMatrixEntry = {
  allowed: [
    TENANT_OWNER,
    OPS_MANAGER,
    SCHEDULER,
    CUSTOMER_SUPPORT,
    FINANCE,
    ANALYST,
  ],
  source: `Bookings §4.3 "View booking" (GraphQL); ${RFC}`,
};
const JOB_CREATE: RoleMatrixEntry = {
  allowed: [TENANT_OWNER, OPS_MANAGER, SCHEDULER, CUSTOMER_SUPPORT],
  source: `Jobs & Checklists §4.3 "Create job from booking"; ${RFC}`,
};
const JOB_ASSIGN: RoleMatrixEntry = {
  allowed: [TENANT_OWNER, OPS_MANAGER, SCHEDULER],
  source: `Jobs & Checklists §4.3 "Assign team to job"; ${RFC}`,
};
const JOB_EXECUTE: RoleMatrixEntry = {
  allowed: [TENANT_OWNER, OPS_MANAGER, SCHEDULER],
  source: `Jobs & Checklists §4.3 "Complete checklist item / complete job"; ${RFC}`,
};
const JOB_VIEW: RoleMatrixEntry = {
  allowed: [
    TENANT_OWNER,
    OPS_MANAGER,
    SCHEDULER,
    CUSTOMER_SUPPORT,
    FINANCE,
    ANALYST,
  ],
  source: `Jobs & Checklists §4.3 "View job"; ${RFC}`,
};
const LAUNDRY_VIEW: RoleMatrixEntry = {
  allowed: [
    TENANT_OWNER,
    OPS_MANAGER,
    SCHEDULER,
    CUSTOMER_SUPPORT,
    FINANCE,
    ANALYST,
  ],
  source: `Laundry Orders & Lifecycle §4.4 (reads use VIEW_ROLES, M3 Accepted 2026-09-06); ${RFC}`,
};
const laundryVerb = (
  verb: string,
  allowed: readonly Role[],
): RoleMatrixEntry => ({
  allowed,
  source: `Laundry Orders & Lifecycle §4.4 verb table "${verb}" (M3 Accepted 2026-09-06); ${RFC}`,
});
const INVOICE_GENERATE: RoleMatrixEntry = {
  allowed: [TENANT_OWNER, FINANCE],
  source: `Laundry Invoices §4.7/§4.8 "FINANCE or OWNER"; ${RFC}`,
};
const INVOICE_VIEW: RoleMatrixEntry = {
  allowed: [
    TENANT_OWNER,
    OPS_MANAGER,
    SCHEDULER,
    CUSTOMER_SUPPORT,
    FINANCE,
    ANALYST,
  ],
  source: `Laundry Invoices §4.7 "VIEW roles"; ${RFC}`,
};
const REST_BOOKING_WRITE: RoleMatrixEntry = {
  allowed: [TENANT_OWNER, OPS_MANAGER, SCHEDULER, CUSTOMER_SUPPORT],
  source:
    'REST: Booking tenant isolation plan #85 (Accepted) — BookingController per-route @Roles(...WRITE_ROLES); RFC §4.5 (REST is a tenant surface); #91 slice decision 1',
};
const REST_BOOKING_VIEW: RoleMatrixEntry = {
  allowed: [
    TENANT_OWNER,
    OPS_MANAGER,
    SCHEDULER,
    CUSTOMER_SUPPORT,
    FINANCE,
    ANALYST,
  ],
  source:
    'REST: Booking tenant isolation plan #85 (Accepted) — BookingController per-route @Roles(...VIEW_ROLES); RFC §4.5; #91 slice decision 1',
};

// Keys sorted (lint). 59 GraphQL + 5 REST = 64.
export const ROLE_MATRIX: Readonly<Record<string, RoleMatrixEntry>> = {
  'DELETE /bookings/:id': REST_BOOKING_WRITE,
  'GET /bookings': REST_BOOKING_VIEW,
  'GET /bookings/:id': REST_BOOKING_VIEW,
  'Mutation.assignCleanerToTeam': TEAM_WRITE,
  'Mutation.assignTeamToJob': JOB_ASSIGN,
  'Mutation.cancelLaundryOrder': laundryVerb('cancelLaundryOrder', [
    TENANT_OWNER,
    OPS_MANAGER,
    CUSTOMER_SUPPORT,
  ]),
  'Mutation.completeChecklistItem': JOB_EXECUTE,
  'Mutation.completeJob': JOB_EXECUTE,
  'Mutation.completeLaundryOrder': laundryVerb('completeLaundryOrder', [
    TENANT_OWNER,
    OPS_MANAGER,
    SCHEDULER,
    CUSTOMER_SUPPORT,
  ]),
  'Mutation.createAddOn': ADD_ON_WRITE,
  'Mutation.createAdmin': STAFF_ADMIN,
  'Mutation.createBooking': BOOKING_WRITE,
  'Mutation.createCleaner': CLEANER_WRITE,
  'Mutation.createCustomer': CUSTOMER_WRITE,
  'Mutation.createJobFromBooking': JOB_CREATE,
  'Mutation.createPricingRule': PRICING_RULE_WRITE,
  'Mutation.createProperty': PROPERTY_WRITE,
  'Mutation.createService': SERVICE_WRITE,
  'Mutation.createTeam': TEAM_WRITE,
  'Mutation.disableAdmin': STAFF_ADMIN,
  'Mutation.generateInvoiceFromOrder': INVOICE_GENERATE,
  'Mutation.markLaundryOrderAwaitingDelivery': laundryVerb(
    'markLaundryOrderAwaitingDelivery',
    [TENANT_OWNER, OPS_MANAGER, SCHEDULER],
  ),
  'Mutation.markLaundryOrderAwaitingPayment': laundryVerb(
    'markLaundryOrderAwaitingPayment',
    [TENANT_OWNER, OPS_MANAGER, FINANCE, CUSTOMER_SUPPORT],
  ),
  'Mutation.markLaundryOrderAwaitingPickup': laundryVerb(
    'markLaundryOrderAwaitingPickup',
    [TENANT_OWNER, OPS_MANAGER, SCHEDULER],
  ),
  'Mutation.markLaundryOrderDamaged': laundryVerb('markLaundryOrderDamaged', [
    TENANT_OWNER,
    OPS_MANAGER,
  ]),
  'Mutation.markLaundryOrderLost': laundryVerb('markLaundryOrderLost', [
    TENANT_OWNER,
    OPS_MANAGER,
  ]),
  'Mutation.markLaundryOrderPaid': laundryVerb('markLaundryOrderPaid', [
    TENANT_OWNER,
    OPS_MANAGER,
    FINANCE,
    CUSTOMER_SUPPORT,
  ]),
  'Mutation.markLaundryOrderReady': laundryVerb('markLaundryOrderReady', [
    TENANT_OWNER,
    OPS_MANAGER,
    SCHEDULER,
  ]),
  'Mutation.priceLaundryOrder': laundryVerb('priceLaundryOrder', [
    TENANT_OWNER,
    OPS_MANAGER,
    SCHEDULER,
  ]),
  'Mutation.receiveLaundryOrder': laundryVerb('receiveLaundryOrder', [
    TENANT_OWNER,
    OPS_MANAGER,
    SCHEDULER,
    CUSTOMER_SUPPORT,
  ]),
  'Mutation.refundLaundryOrder': laundryVerb('refundLaundryOrder', [
    TENANT_OWNER,
    OPS_MANAGER,
    FINANCE,
  ]),
  'Mutation.rejectLaundryOrder': laundryVerb('rejectLaundryOrder', [
    TENANT_OWNER,
    OPS_MANAGER,
  ]),
  'Mutation.removeBooking': BOOKING_WRITE,
  'Mutation.startLaundryProcessing': laundryVerb('startLaundryProcessing', [
    TENANT_OWNER,
    OPS_MANAGER,
    SCHEDULER,
  ]),
  'Mutation.updateAddOn': ADD_ON_WRITE,
  'Mutation.updateBooking': BOOKING_WRITE,
  'Mutation.updateCleaner': CLEANER_WRITE,
  'Mutation.updateCustomer': CUSTOMER_WRITE,
  'Mutation.updateProperty': PROPERTY_WRITE,
  'Mutation.updateService': SERVICE_WRITE,
  'Mutation.weighLaundryOrder': laundryVerb('weighLaundryOrder', [
    TENANT_OWNER,
    OPS_MANAGER,
    SCHEDULER,
  ]),
  'PATCH /bookings/:id': REST_BOOKING_WRITE,
  'POST /bookings': REST_BOOKING_WRITE,
  'Query.activePricing': CATALOG_VIEW,
  'Query.addOns': CATALOG_VIEW,
  'Query.admins': STAFF_ADMIN,
  'Query.booking': BOOKING_VIEW,
  'Query.bookings': BOOKING_VIEW,
  'Query.cleaner': WORKFORCE_VIEW,
  'Query.cleaners': WORKFORCE_VIEW,
  'Query.customer': CUSTOMER_VIEW,
  'Query.customerProperties': CUSTOMER_VIEW,
  'Query.customers': CUSTOMER_VIEW,
  'Query.invoice': INVOICE_VIEW,
  'Query.invoices': INVOICE_VIEW,
  'Query.job': JOB_VIEW,
  'Query.jobs': JOB_VIEW,
  'Query.laundryOrder': LAUNDRY_VIEW,
  'Query.laundryOrders': LAUNDRY_VIEW,
  'Query.property': CUSTOMER_VIEW,
  'Query.service': CATALOG_VIEW,
  'Query.services': CATALOG_VIEW,
  'Query.team': WORKFORCE_VIEW,
  'Query.teams': WORKFORCE_VIEW,
};
