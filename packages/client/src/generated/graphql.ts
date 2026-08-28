/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
const defaultOptions = {} as const;
export type AddOnFilter = {
  active?: BooleanFieldComparison | null | undefined;
  and?: Array<AddOnFilter> | null | undefined;
  createdAt?: DateFieldComparison | null | undefined;
  id?: IdFilterComparison | null | undefined;
  name?: StringFieldComparison | null | undefined;
  or?: Array<AddOnFilter> | null | undefined;
};

export type AddOnSort = {
  direction: SortDirection;
  field: AddOnSortFields;
  nulls?: SortNulls | null | undefined;
};

export type AddOnSortFields =
  | 'active'
  | 'createdAt'
  | 'id'
  | 'name';

export type AssignTeamToJobInput = {
  jobId: string | number;
  teamId: string | number;
};

export type BookingFilter = {
  and?: Array<BookingFilter> | null | undefined;
  createdAt?: DateFieldComparison | null | undefined;
  customer?: BookingFilterCustomerFilter | null | undefined;
  id?: IdFilterComparison | null | undefined;
  or?: Array<BookingFilter> | null | undefined;
  property?: BookingFilterPropertyFilter | null | undefined;
  scheduledAt?: DateFieldComparison | null | undefined;
  service?: BookingFilterServiceFilter | null | undefined;
  status?: BookingStatusFilterComparison | null | undefined;
  team?: BookingFilterTeamFilter | null | undefined;
};

export type BookingFilterCustomerFilter = {
  and?: Array<BookingFilterCustomerFilter> | null | undefined;
  createdAt?: DateFieldComparison | null | undefined;
  fullName?: StringFieldComparison | null | undefined;
  id?: IdFilterComparison | null | undefined;
  or?: Array<BookingFilterCustomerFilter> | null | undefined;
};

export type BookingFilterPropertyFilter = {
  addressLine1?: StringFieldComparison | null | undefined;
  and?: Array<BookingFilterPropertyFilter> | null | undefined;
  createdAt?: DateFieldComparison | null | undefined;
  customerId?: IdFilterComparison | null | undefined;
  id?: IdFilterComparison | null | undefined;
  or?: Array<BookingFilterPropertyFilter> | null | undefined;
};

export type BookingFilterServiceFilter = {
  active?: BooleanFieldComparison | null | undefined;
  and?: Array<BookingFilterServiceFilter> | null | undefined;
  createdAt?: DateFieldComparison | null | undefined;
  id?: IdFilterComparison | null | undefined;
  name?: StringFieldComparison | null | undefined;
  or?: Array<BookingFilterServiceFilter> | null | undefined;
};

export type BookingFilterTeamFilter = {
  and?: Array<BookingFilterTeamFilter> | null | undefined;
  createdAt?: DateFieldComparison | null | undefined;
  id?: IdFilterComparison | null | undefined;
  name?: StringFieldComparison | null | undefined;
  or?: Array<BookingFilterTeamFilter> | null | undefined;
};

export type BookingSort = {
  direction: SortDirection;
  field: BookingSortFields;
  nulls?: SortNulls | null | undefined;
};

export type BookingSortFields =
  | 'createdAt'
  | 'id'
  | 'scheduledAt'
  | 'status';

export type BookingStatus =
  | 'CANCELLED'
  | 'COMPLETED'
  | 'CONFIRMED'
  | 'PENDING';

export type BookingStatusFilterComparison = {
  eq?: BookingStatus | null | undefined;
  gt?: BookingStatus | null | undefined;
  gte?: BookingStatus | null | undefined;
  iLike?: BookingStatus | null | undefined;
  in?: Array<BookingStatus> | null | undefined;
  is?: boolean | null | undefined;
  isNot?: boolean | null | undefined;
  like?: BookingStatus | null | undefined;
  lt?: BookingStatus | null | undefined;
  lte?: BookingStatus | null | undefined;
  neq?: BookingStatus | null | undefined;
  notILike?: BookingStatus | null | undefined;
  notIn?: Array<BookingStatus> | null | undefined;
  notLike?: BookingStatus | null | undefined;
};

export type BooleanFieldComparison = {
  is?: boolean | null | undefined;
  isNot?: boolean | null | undefined;
};

export type CleanerFilter = {
  and?: Array<CleanerFilter> | null | undefined;
  createdAt?: DateFieldComparison | null | undefined;
  email?: StringFieldComparison | null | undefined;
  fullName?: StringFieldComparison | null | undefined;
  id?: IdFilterComparison | null | undefined;
  or?: Array<CleanerFilter> | null | undefined;
};

export type CleanerSort = {
  direction: SortDirection;
  field: CleanerSortFields;
  nulls?: SortNulls | null | undefined;
};

export type CleanerSortFields =
  | 'createdAt'
  | 'email'
  | 'fullName'
  | 'id';

export type CleaningJobFilter = {
  and?: Array<CleaningJobFilter> | null | undefined;
  booking?: CleaningJobFilterBookingFilter | null | undefined;
  createdAt?: DateFieldComparison | null | undefined;
  id?: IdFilterComparison | null | undefined;
  or?: Array<CleaningJobFilter> | null | undefined;
  scheduledAt?: DateFieldComparison | null | undefined;
  status?: JobStatusFilterComparison | null | undefined;
};

export type CleaningJobFilterBookingFilter = {
  and?: Array<CleaningJobFilterBookingFilter> | null | undefined;
  createdAt?: DateFieldComparison | null | undefined;
  id?: IdFilterComparison | null | undefined;
  or?: Array<CleaningJobFilterBookingFilter> | null | undefined;
  scheduledAt?: DateFieldComparison | null | undefined;
  status?: BookingStatusFilterComparison | null | undefined;
};

export type CleaningJobSort = {
  direction: SortDirection;
  field: CleaningJobSortFields;
  nulls?: SortNulls | null | undefined;
};

export type CleaningJobSortFields =
  | 'createdAt'
  | 'id'
  | 'scheduledAt'
  | 'status';

export type CompleteChecklistItemInput = {
  itemId: string | number;
  jobId: string | number;
};

export type CompleteJobInput = {
  id: string | number;
};

export type CreateAddOnInput = {
  description?: string | null | undefined;
  name: string;
  priceMinorUnits: number;
};

export type CreateAdminInput = {
  email: string;
  password: string;
  role: Role;
};

export type CreateBookingInput = {
  customerId: string | number;
  propertyId: string | number;
  scheduledAt: unknown;
  serviceId: string | number;
  teamId?: string | number | null | undefined;
};

export type CreateCleanerInput = {
  email: string;
  fullName: string;
  notes?: string | null | undefined;
  phone: string;
};

export type CreateCustomerInput = {
  email: string;
  fullName: string;
  notes?: string | null | undefined;
  phone: string;
};

export type CreateJobFromBookingInput = {
  bookingId: string | number;
};

export type CreatePricingRuleInput = {
  priceMinorUnits: number;
  serviceId: string | number;
};

export type CreatePropertyInput = {
  accessNotes?: string | null | undefined;
  addressLine1: string;
  addressLine2?: string | null | undefined;
  city: string;
  label: string;
  postalCode: string;
  region: string;
};

export type CreateServiceInput = {
  description?: string | null | undefined;
  durationMinutes: number;
  name: string;
};

export type CreateTeamInput = {
  name: string;
};

export type CustomerFilter = {
  and?: Array<CustomerFilter> | null | undefined;
  createdAt?: DateFieldComparison | null | undefined;
  fullName?: StringFieldComparison | null | undefined;
  id?: IdFilterComparison | null | undefined;
  or?: Array<CustomerFilter> | null | undefined;
};

export type CustomerSort = {
  direction: SortDirection;
  field: CustomerSortFields;
  nulls?: SortNulls | null | undefined;
};

export type CustomerSortFields =
  | 'createdAt'
  | 'fullName'
  | 'id';

export type DateFieldComparison = {
  between?: DateFieldComparisonBetween | null | undefined;
  eq?: unknown;
  gt?: unknown;
  gte?: unknown;
  in?: Array<unknown> | null | undefined;
  is?: boolean | null | undefined;
  isNot?: boolean | null | undefined;
  lt?: unknown;
  lte?: unknown;
  neq?: unknown;
  notBetween?: DateFieldComparisonBetween | null | undefined;
  notIn?: Array<unknown> | null | undefined;
};

export type DateFieldComparisonBetween = {
  lower: unknown;
  upper: unknown;
};

export type IdFilterComparison = {
  eq?: string | number | null | undefined;
  gt?: string | number | null | undefined;
  gte?: string | number | null | undefined;
  iLike?: string | number | null | undefined;
  in?: Array<string | number> | null | undefined;
  is?: boolean | null | undefined;
  isNot?: boolean | null | undefined;
  like?: string | number | null | undefined;
  lt?: string | number | null | undefined;
  lte?: string | number | null | undefined;
  neq?: string | number | null | undefined;
  notILike?: string | number | null | undefined;
  notIn?: Array<string | number> | null | undefined;
  notLike?: string | number | null | undefined;
};

export type JobStatus =
  | 'COMPLETED'
  | 'IN_PROGRESS'
  | 'PENDING';

export type JobStatusFilterComparison = {
  eq?: JobStatus | null | undefined;
  gt?: JobStatus | null | undefined;
  gte?: JobStatus | null | undefined;
  iLike?: JobStatus | null | undefined;
  in?: Array<JobStatus> | null | undefined;
  is?: boolean | null | undefined;
  isNot?: boolean | null | undefined;
  like?: JobStatus | null | undefined;
  lt?: JobStatus | null | undefined;
  lte?: JobStatus | null | undefined;
  neq?: JobStatus | null | undefined;
  notILike?: JobStatus | null | undefined;
  notIn?: Array<JobStatus> | null | undefined;
  notLike?: JobStatus | null | undefined;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type OffsetPaging = {
  /** Limit the number of records returned */
  limit?: number | null | undefined;
  /** Offset to start returning records from */
  offset?: number | null | undefined;
};

export type PropertyFilter = {
  addressLine1?: StringFieldComparison | null | undefined;
  and?: Array<PropertyFilter> | null | undefined;
  createdAt?: DateFieldComparison | null | undefined;
  customerId?: IdFilterComparison | null | undefined;
  id?: IdFilterComparison | null | undefined;
  or?: Array<PropertyFilter> | null | undefined;
};

export type Role =
  | 'ANALYST'
  | 'CUSTOMER_SUPPORT'
  | 'FINANCE'
  | 'OPS_MANAGER'
  | 'OWNER'
  | 'SCHEDULER';

export type ServiceFilter = {
  active?: BooleanFieldComparison | null | undefined;
  and?: Array<ServiceFilter> | null | undefined;
  createdAt?: DateFieldComparison | null | undefined;
  id?: IdFilterComparison | null | undefined;
  name?: StringFieldComparison | null | undefined;
  or?: Array<ServiceFilter> | null | undefined;
};

export type ServiceSort = {
  direction: SortDirection;
  field: ServiceSortFields;
  nulls?: SortNulls | null | undefined;
};

export type ServiceSortFields =
  | 'active'
  | 'createdAt'
  | 'id'
  | 'name';

/** Sort Directions */
export type SortDirection =
  | 'ASC'
  | 'DESC';

/** Sort Nulls Options */
export type SortNulls =
  | 'NULLS_FIRST'
  | 'NULLS_LAST';

export type StringFieldComparison = {
  eq?: string | null | undefined;
  gt?: string | null | undefined;
  gte?: string | null | undefined;
  iLike?: string | null | undefined;
  in?: Array<string> | null | undefined;
  is?: boolean | null | undefined;
  isNot?: boolean | null | undefined;
  like?: string | null | undefined;
  lt?: string | null | undefined;
  lte?: string | null | undefined;
  neq?: string | null | undefined;
  notILike?: string | null | undefined;
  notIn?: Array<string> | null | undefined;
  notLike?: string | null | undefined;
};

export type TeamFilter = {
  and?: Array<TeamFilter> | null | undefined;
  createdAt?: DateFieldComparison | null | undefined;
  id?: IdFilterComparison | null | undefined;
  name?: StringFieldComparison | null | undefined;
  or?: Array<TeamFilter> | null | undefined;
};

export type TeamSort = {
  direction: SortDirection;
  field: TeamSortFields;
  nulls?: SortNulls | null | undefined;
};

export type TeamSortFields =
  | 'createdAt'
  | 'id'
  | 'name';

export type UpdateAddOnInput = {
  active?: boolean | null | undefined;
  description?: string | null | undefined;
  name?: string | null | undefined;
  priceMinorUnits?: number | null | undefined;
};

export type UpdateBookingInput = {
  id: string | number;
  scheduledAt?: unknown;
  status?: BookingStatus | null | undefined;
  teamId?: string | number | null | undefined;
};

export type UpdateCleanerInput = {
  email?: string | null | undefined;
  fullName?: string | null | undefined;
  notes?: string | null | undefined;
  phone?: string | null | undefined;
};

export type UpdateCustomerInput = {
  email?: string | null | undefined;
  fullName?: string | null | undefined;
  notes?: string | null | undefined;
  phone?: string | null | undefined;
};

export type UpdatePropertyInput = {
  accessNotes?: string | null | undefined;
  addressLine1?: string | null | undefined;
  addressLine2?: string | null | undefined;
  city?: string | null | undefined;
  label?: string | null | undefined;
  postalCode?: string | null | undefined;
  region?: string | null | undefined;
};

export type UpdateServiceInput = {
  active?: boolean | null | undefined;
  description?: string | null | undefined;
  durationMinutes?: number | null | undefined;
  name?: string | null | undefined;
};

export type AddOnsQueryVariables = Exact<{
  paging?: OffsetPaging | null | undefined;
  filter?: AddOnFilter | null | undefined;
  sorting?: Array<AddOnSort> | AddOnSort | null | undefined;
}>;


export type AddOnsQuery = { addOns: { totalCount: number, pageInfo: { hasNextPage: boolean | null, hasPreviousPage: boolean | null }, nodes: Array<{ id: string, name: string, description: string | null, priceMinorUnits: number, active: boolean }> } };

export type CreateAddOnMutationVariables = Exact<{
  input: CreateAddOnInput;
}>;


export type CreateAddOnMutation = { createAddOn: { id: string } };

export type UpdateAddOnMutationVariables = Exact<{
  id: string | number;
  input: UpdateAddOnInput;
}>;


export type UpdateAddOnMutation = { updateAddOn: { id: string } };

export type AdminsQueryVariables = Exact<{ [key: string]: never; }>;


export type AdminsQuery = { admins: Array<{ id: string, email: string, role: Role, isActive: boolean }> };

export type BookingsQueryVariables = Exact<{
  paging?: OffsetPaging | null | undefined;
  filter?: BookingFilter | null | undefined;
  sorting?: Array<BookingSort> | BookingSort | null | undefined;
}>;


export type BookingsQuery = { bookings: { totalCount: number, pageInfo: { hasNextPage: boolean | null, hasPreviousPage: boolean | null }, nodes: Array<{ id: string, scheduledAt: unknown, status: BookingStatus, pricingSnapshot: { priceMinorUnits: number }, customer: { id: string, fullName: string }, property: { id: string, addressLine1: string }, service: { id: string, name: string }, team: { id: string, name: string } | null }> } };

export type BookingQueryVariables = Exact<{
  id: string | number;
}>;


export type BookingQuery = { booking: { id: string, scheduledAt: unknown, status: BookingStatus, pricingSnapshot: { priceMinorUnits: number }, customer: { id: string, fullName: string }, property: { id: string, addressLine1: string }, service: { id: string, name: string }, team: { id: string, name: string } | null } };

export type CreateBookingMutationVariables = Exact<{
  createBookingInput: CreateBookingInput;
}>;


export type CreateBookingMutation = { createBooking: { id: string } };

export type UpdateBookingMutationVariables = Exact<{
  updateBookingInput: UpdateBookingInput;
}>;


export type UpdateBookingMutation = { updateBooking: { id: string } };

export type RemoveBookingMutationVariables = Exact<{
  id: string | number;
}>;


export type RemoveBookingMutation = { removeBooking: { id: string } };

export type CleanersQueryVariables = Exact<{
  paging?: OffsetPaging | null | undefined;
  filter?: CleanerFilter | null | undefined;
  sorting?: Array<CleanerSort> | CleanerSort | null | undefined;
}>;


export type CleanersQuery = { cleaners: { totalCount: number, pageInfo: { hasNextPage: boolean | null, hasPreviousPage: boolean | null }, nodes: Array<{ id: string, fullName: string, phone: string, email: string, team: { id: string, name: string } | null }> } };

export type CleanerQueryVariables = Exact<{
  id: string | number;
}>;


export type CleanerQuery = { cleaner: { id: string, fullName: string, phone: string, email: string, notes: string | null, team: { id: string, name: string } | null } | null };

export type CreateCleanerMutationVariables = Exact<{
  input: CreateCleanerInput;
}>;


export type CreateCleanerMutation = { createCleaner: { id: string } };

export type UpdateCleanerMutationVariables = Exact<{
  id: string | number;
  input: UpdateCleanerInput;
}>;


export type UpdateCleanerMutation = { updateCleaner: { id: string } };

export type AssignCleanerToTeamMutationVariables = Exact<{
  cleanerId: string | number;
  teamId: string | number;
}>;


export type AssignCleanerToTeamMutation = { assignCleanerToTeam: { id: string } };

export type CreateAdminMutationVariables = Exact<{
  createAdminInput: CreateAdminInput;
}>;


export type CreateAdminMutation = { createAdmin: { id: string, email: string, role: Role, isActive: boolean } };

export type CurrentAdminQueryVariables = Exact<{ [key: string]: never; }>;


export type CurrentAdminQuery = { currentAdmin: { id: string, role: Role } };

export type CustomersQueryVariables = Exact<{
  paging?: OffsetPaging | null | undefined;
  filter?: CustomerFilter | null | undefined;
  sorting?: Array<CustomerSort> | CustomerSort | null | undefined;
}>;


export type CustomersQuery = { customers: { totalCount: number, pageInfo: { hasNextPage: boolean | null, hasPreviousPage: boolean | null }, nodes: Array<{ id: string, fullName: string, email: string, phone: string }> } };

export type CustomerQueryVariables = Exact<{
  id: string | number;
}>;


export type CustomerQuery = { customer: { id: string, fullName: string, email: string, phone: string, notes: string | null, properties: { nodes: Array<{ id: string, label: string, addressLine1: string, addressLine2: string | null, city: string, region: string, postalCode: string, accessNotes: string | null }>, pageInfo: { hasNextPage: boolean | null } } } | null };

export type CreateCustomerMutationVariables = Exact<{
  input: CreateCustomerInput;
}>;


export type CreateCustomerMutation = { createCustomer: { id: string } };

export type UpdateCustomerMutationVariables = Exact<{
  id: string | number;
  input: UpdateCustomerInput;
}>;


export type UpdateCustomerMutation = { updateCustomer: { id: string } };

export type DisableAdminMutationVariables = Exact<{
  id: string | number;
}>;


export type DisableAdminMutation = { disableAdmin: { id: string, email: string, role: Role, isActive: boolean } };

export type JobFieldsFragment = { id: string, scheduledAt: unknown, status: JobStatus, createdAt: unknown, updatedAt: unknown, booking: { id: string, scheduledAt: unknown, status: BookingStatus, customer: { id: string, fullName: string }, property: { id: string, addressLine1: string }, service: { id: string, name: string }, team: { id: string, name: string } | null }, team: { id: string, name: string } | null, checklist: { id: string, items: { nodes: Array<{ id: string, label: string, position: number, completed: boolean, completedAt: unknown }>, pageInfo: { hasNextPage: boolean | null } } } };

export type JobsQueryVariables = Exact<{
  paging?: OffsetPaging | null | undefined;
  filter?: CleaningJobFilter | null | undefined;
  sorting?: Array<CleaningJobSort> | CleaningJobSort | null | undefined;
}>;


export type JobsQuery = { jobs: { totalCount: number, pageInfo: { hasNextPage: boolean | null, hasPreviousPage: boolean | null }, nodes: Array<{ id: string, scheduledAt: unknown, status: JobStatus, createdAt: unknown, updatedAt: unknown, booking: { id: string, scheduledAt: unknown, status: BookingStatus, customer: { id: string, fullName: string }, property: { id: string, addressLine1: string }, service: { id: string, name: string }, team: { id: string, name: string } | null }, team: { id: string, name: string } | null, checklist: { id: string, items: { nodes: Array<{ id: string, label: string, position: number, completed: boolean, completedAt: unknown }>, pageInfo: { hasNextPage: boolean | null } } } }> } };

export type JobQueryVariables = Exact<{
  id: string | number;
}>;


export type JobQuery = { job: { id: string, scheduledAt: unknown, status: JobStatus, createdAt: unknown, updatedAt: unknown, booking: { id: string, scheduledAt: unknown, status: BookingStatus, customer: { id: string, fullName: string }, property: { id: string, addressLine1: string }, service: { id: string, name: string }, team: { id: string, name: string } | null }, team: { id: string, name: string } | null, checklist: { id: string, items: { nodes: Array<{ id: string, label: string, position: number, completed: boolean, completedAt: unknown }>, pageInfo: { hasNextPage: boolean | null } } } } | null };

export type JobByBookingQueryVariables = Exact<{
  bookingId: string | number;
}>;


export type JobByBookingQuery = { jobs: { nodes: Array<{ id: string }> } };

export type CreateJobFromBookingMutationVariables = Exact<{
  input: CreateJobFromBookingInput;
}>;


export type CreateJobFromBookingMutation = { createJobFromBooking: { id: string, scheduledAt: unknown, status: JobStatus, createdAt: unknown, updatedAt: unknown, booking: { id: string, scheduledAt: unknown, status: BookingStatus, customer: { id: string, fullName: string }, property: { id: string, addressLine1: string }, service: { id: string, name: string }, team: { id: string, name: string } | null }, team: { id: string, name: string } | null, checklist: { id: string, items: { nodes: Array<{ id: string, label: string, position: number, completed: boolean, completedAt: unknown }>, pageInfo: { hasNextPage: boolean | null } } } } };

export type AssignTeamToJobMutationVariables = Exact<{
  input: AssignTeamToJobInput;
}>;


export type AssignTeamToJobMutation = { assignTeamToJob: { id: string, scheduledAt: unknown, status: JobStatus, createdAt: unknown, updatedAt: unknown, booking: { id: string, scheduledAt: unknown, status: BookingStatus, customer: { id: string, fullName: string }, property: { id: string, addressLine1: string }, service: { id: string, name: string }, team: { id: string, name: string } | null }, team: { id: string, name: string } | null, checklist: { id: string, items: { nodes: Array<{ id: string, label: string, position: number, completed: boolean, completedAt: unknown }>, pageInfo: { hasNextPage: boolean | null } } } } };

export type CompleteChecklistItemMutationVariables = Exact<{
  input: CompleteChecklistItemInput;
}>;


export type CompleteChecklistItemMutation = { completeChecklistItem: { id: string, scheduledAt: unknown, status: JobStatus, createdAt: unknown, updatedAt: unknown, booking: { id: string, scheduledAt: unknown, status: BookingStatus, customer: { id: string, fullName: string }, property: { id: string, addressLine1: string }, service: { id: string, name: string }, team: { id: string, name: string } | null }, team: { id: string, name: string } | null, checklist: { id: string, items: { nodes: Array<{ id: string, label: string, position: number, completed: boolean, completedAt: unknown }>, pageInfo: { hasNextPage: boolean | null } } } } };

export type CompleteJobMutationVariables = Exact<{
  input: CompleteJobInput;
}>;


export type CompleteJobMutation = { completeJob: { id: string, scheduledAt: unknown, status: JobStatus, createdAt: unknown, updatedAt: unknown, booking: { id: string, scheduledAt: unknown, status: BookingStatus, customer: { id: string, fullName: string }, property: { id: string, addressLine1: string }, service: { id: string, name: string }, team: { id: string, name: string } | null }, team: { id: string, name: string } | null, checklist: { id: string, items: { nodes: Array<{ id: string, label: string, position: number, completed: boolean, completedAt: unknown }>, pageInfo: { hasNextPage: boolean | null } } } } };

export type LoginMutationVariables = Exact<{
  loginInput: LoginInput;
}>;


export type LoginMutation = { login: { success: boolean, admin: { id: string, role: Role } } };

export type LogoutMutationVariables = Exact<{ [key: string]: never; }>;


export type LogoutMutation = { logout: boolean };

export type CustomerPropertiesQueryVariables = Exact<{
  customerId: string | number;
  paging?: OffsetPaging | null | undefined;
  filter?: PropertyFilter | null | undefined;
}>;


export type CustomerPropertiesQuery = { customerProperties: { totalCount: number, pageInfo: { hasNextPage: boolean | null, hasPreviousPage: boolean | null }, nodes: Array<{ id: string, label: string, addressLine1: string }> } };

export type CreatePropertyMutationVariables = Exact<{
  customerId: string | number;
  input: CreatePropertyInput;
}>;


export type CreatePropertyMutation = { createProperty: { id: string } };

export type UpdatePropertyMutationVariables = Exact<{
  id: string | number;
  input: UpdatePropertyInput;
}>;


export type UpdatePropertyMutation = { updateProperty: { id: string } };

export type ServicesQueryVariables = Exact<{
  paging?: OffsetPaging | null | undefined;
  filter?: ServiceFilter | null | undefined;
  sorting?: Array<ServiceSort> | ServiceSort | null | undefined;
}>;


export type ServicesQuery = { services: { totalCount: number, pageInfo: { hasNextPage: boolean | null, hasPreviousPage: boolean | null }, nodes: Array<{ id: string, name: string, durationMinutes: number, active: boolean, activePricing: { priceMinorUnits: number } | null }> } };

export type ServiceQueryVariables = Exact<{
  id: string | number;
}>;


export type ServiceQuery = { service: { id: string, name: string, description: string | null, durationMinutes: number, active: boolean, activePricing: { id: string, priceMinorUnits: number } | null } | null };

export type CreateServiceMutationVariables = Exact<{
  input: CreateServiceInput;
}>;


export type CreateServiceMutation = { createService: { id: string } };

export type UpdateServiceMutationVariables = Exact<{
  id: string | number;
  input: UpdateServiceInput;
}>;


export type UpdateServiceMutation = { updateService: { id: string } };

export type CreatePricingRuleMutationVariables = Exact<{
  input: CreatePricingRuleInput;
}>;


export type CreatePricingRuleMutation = { createPricingRule: { id: string, priceMinorUnits: number } };

export type TeamsQueryVariables = Exact<{
  paging?: OffsetPaging | null | undefined;
  filter?: TeamFilter | null | undefined;
  sorting?: Array<TeamSort> | TeamSort | null | undefined;
}>;


export type TeamsQuery = { teams: { totalCount: number, pageInfo: { hasNextPage: boolean | null, hasPreviousPage: boolean | null }, nodes: Array<{ id: string, name: string, cleaners: { nodes: Array<{ id: string }>, pageInfo: { hasNextPage: boolean | null } } }> } };

export type TeamQueryVariables = Exact<{
  id: string | number;
}>;


export type TeamQuery = { team: { id: string, name: string, cleaners: { nodes: Array<{ id: string, fullName: string, phone: string, email: string }>, pageInfo: { hasNextPage: boolean | null } } } | null };

export type CreateTeamMutationVariables = Exact<{
  input: CreateTeamInput;
}>;


export type CreateTeamMutation = { createTeam: { id: string } };

export const JobFieldsFragmentDoc = gql`
    fragment JobFields on CleaningJob {
  id
  scheduledAt
  status
  createdAt
  updatedAt
  booking {
    id
    scheduledAt
    status
    customer {
      id
      fullName
    }
    property {
      id
      addressLine1
    }
    service {
      id
      name
    }
    team {
      id
      name
    }
  }
  team {
    id
    name
  }
  checklist {
    id
    items(paging: { limit: 20 }) {
      nodes {
        id
        label
        position
        completed
        completedAt
      }
      pageInfo {
        hasNextPage
      }
    }
  }
}
    `;
export const AddOnsDocument = gql`
    query AddOns($paging: OffsetPaging, $filter: AddOnFilter, $sorting: [AddOnSort!]) {
  addOns(paging: $paging, filter: $filter, sorting: $sorting) {
    totalCount
    pageInfo {
      hasNextPage
      hasPreviousPage
    }
    nodes {
      id
      name
      description
      priceMinorUnits
      active
    }
  }
}
    `;

/**
 * __useAddOnsQuery__
 *
 * To run a query within a React component, call `useAddOnsQuery` and pass it any options that fit your needs.
 * When your component renders, `useAddOnsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useAddOnsQuery({
 *   variables: {
 *      paging: // value for 'paging'
 *      filter: // value for 'filter'
 *      sorting: // value for 'sorting'
 *   },
 * });
 */
export function useAddOnsQuery(baseOptions?: Apollo.QueryHookOptions<AddOnsQuery, AddOnsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<AddOnsQuery, AddOnsQueryVariables>(AddOnsDocument, options);
      }
export function useAddOnsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<AddOnsQuery, AddOnsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<AddOnsQuery, AddOnsQueryVariables>(AddOnsDocument, options);
        }
// @ts-ignore
export function useAddOnsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<AddOnsQuery, AddOnsQueryVariables>): Apollo.UseSuspenseQueryResult<AddOnsQuery, AddOnsQueryVariables>;
export function useAddOnsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AddOnsQuery, AddOnsQueryVariables>): Apollo.UseSuspenseQueryResult<AddOnsQuery | undefined, AddOnsQueryVariables>;
export function useAddOnsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AddOnsQuery, AddOnsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<AddOnsQuery, AddOnsQueryVariables>(AddOnsDocument, options);
        }
export type AddOnsQueryHookResult = ReturnType<typeof useAddOnsQuery>;
export type AddOnsLazyQueryHookResult = ReturnType<typeof useAddOnsLazyQuery>;
export type AddOnsSuspenseQueryHookResult = ReturnType<typeof useAddOnsSuspenseQuery>;
export type AddOnsQueryResult = Apollo.QueryResult<AddOnsQuery, AddOnsQueryVariables>;
export const CreateAddOnDocument = gql`
    mutation CreateAddOn($input: CreateAddOnInput!) {
  createAddOn(input: $input) {
    id
  }
}
    `;
export type CreateAddOnMutationFn = Apollo.MutationFunction<CreateAddOnMutation, CreateAddOnMutationVariables>;

/**
 * __useCreateAddOnMutation__
 *
 * To run a mutation, you first call `useCreateAddOnMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateAddOnMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createAddOnMutation, { data, loading, error }] = useCreateAddOnMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateAddOnMutation(baseOptions?: Apollo.MutationHookOptions<CreateAddOnMutation, CreateAddOnMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateAddOnMutation, CreateAddOnMutationVariables>(CreateAddOnDocument, options);
      }
export type CreateAddOnMutationHookResult = ReturnType<typeof useCreateAddOnMutation>;
export type CreateAddOnMutationResult = Apollo.MutationResult<CreateAddOnMutation>;
export type CreateAddOnMutationOptions = Apollo.BaseMutationOptions<CreateAddOnMutation, CreateAddOnMutationVariables>;
export const UpdateAddOnDocument = gql`
    mutation UpdateAddOn($id: ID!, $input: UpdateAddOnInput!) {
  updateAddOn(id: $id, input: $input) {
    id
  }
}
    `;
export type UpdateAddOnMutationFn = Apollo.MutationFunction<UpdateAddOnMutation, UpdateAddOnMutationVariables>;

/**
 * __useUpdateAddOnMutation__
 *
 * To run a mutation, you first call `useUpdateAddOnMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateAddOnMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateAddOnMutation, { data, loading, error }] = useUpdateAddOnMutation({
 *   variables: {
 *      id: // value for 'id'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdateAddOnMutation(baseOptions?: Apollo.MutationHookOptions<UpdateAddOnMutation, UpdateAddOnMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateAddOnMutation, UpdateAddOnMutationVariables>(UpdateAddOnDocument, options);
      }
export type UpdateAddOnMutationHookResult = ReturnType<typeof useUpdateAddOnMutation>;
export type UpdateAddOnMutationResult = Apollo.MutationResult<UpdateAddOnMutation>;
export type UpdateAddOnMutationOptions = Apollo.BaseMutationOptions<UpdateAddOnMutation, UpdateAddOnMutationVariables>;
export const AdminsDocument = gql`
    query Admins {
  admins {
    id
    email
    role
    isActive
  }
}
    `;

/**
 * __useAdminsQuery__
 *
 * To run a query within a React component, call `useAdminsQuery` and pass it any options that fit your needs.
 * When your component renders, `useAdminsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useAdminsQuery({
 *   variables: {
 *   },
 * });
 */
export function useAdminsQuery(baseOptions?: Apollo.QueryHookOptions<AdminsQuery, AdminsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<AdminsQuery, AdminsQueryVariables>(AdminsDocument, options);
      }
export function useAdminsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<AdminsQuery, AdminsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<AdminsQuery, AdminsQueryVariables>(AdminsDocument, options);
        }
// @ts-ignore
export function useAdminsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<AdminsQuery, AdminsQueryVariables>): Apollo.UseSuspenseQueryResult<AdminsQuery, AdminsQueryVariables>;
export function useAdminsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AdminsQuery, AdminsQueryVariables>): Apollo.UseSuspenseQueryResult<AdminsQuery | undefined, AdminsQueryVariables>;
export function useAdminsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AdminsQuery, AdminsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<AdminsQuery, AdminsQueryVariables>(AdminsDocument, options);
        }
export type AdminsQueryHookResult = ReturnType<typeof useAdminsQuery>;
export type AdminsLazyQueryHookResult = ReturnType<typeof useAdminsLazyQuery>;
export type AdminsSuspenseQueryHookResult = ReturnType<typeof useAdminsSuspenseQuery>;
export type AdminsQueryResult = Apollo.QueryResult<AdminsQuery, AdminsQueryVariables>;
export const BookingsDocument = gql`
    query Bookings($paging: OffsetPaging, $filter: BookingFilter, $sorting: [BookingSort!]) {
  bookings(paging: $paging, filter: $filter, sorting: $sorting) {
    totalCount
    pageInfo {
      hasNextPage
      hasPreviousPage
    }
    nodes {
      id
      scheduledAt
      status
      pricingSnapshot {
        priceMinorUnits
      }
      customer {
        id
        fullName
      }
      property {
        id
        addressLine1
      }
      service {
        id
        name
      }
      team {
        id
        name
      }
    }
  }
}
    `;

/**
 * __useBookingsQuery__
 *
 * To run a query within a React component, call `useBookingsQuery` and pass it any options that fit your needs.
 * When your component renders, `useBookingsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useBookingsQuery({
 *   variables: {
 *      paging: // value for 'paging'
 *      filter: // value for 'filter'
 *      sorting: // value for 'sorting'
 *   },
 * });
 */
export function useBookingsQuery(baseOptions?: Apollo.QueryHookOptions<BookingsQuery, BookingsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<BookingsQuery, BookingsQueryVariables>(BookingsDocument, options);
      }
export function useBookingsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<BookingsQuery, BookingsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<BookingsQuery, BookingsQueryVariables>(BookingsDocument, options);
        }
// @ts-ignore
export function useBookingsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<BookingsQuery, BookingsQueryVariables>): Apollo.UseSuspenseQueryResult<BookingsQuery, BookingsQueryVariables>;
export function useBookingsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<BookingsQuery, BookingsQueryVariables>): Apollo.UseSuspenseQueryResult<BookingsQuery | undefined, BookingsQueryVariables>;
export function useBookingsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<BookingsQuery, BookingsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<BookingsQuery, BookingsQueryVariables>(BookingsDocument, options);
        }
export type BookingsQueryHookResult = ReturnType<typeof useBookingsQuery>;
export type BookingsLazyQueryHookResult = ReturnType<typeof useBookingsLazyQuery>;
export type BookingsSuspenseQueryHookResult = ReturnType<typeof useBookingsSuspenseQuery>;
export type BookingsQueryResult = Apollo.QueryResult<BookingsQuery, BookingsQueryVariables>;
export const BookingDocument = gql`
    query Booking($id: ID!) {
  booking(id: $id) {
    id
    scheduledAt
    status
    pricingSnapshot {
      priceMinorUnits
    }
    customer {
      id
      fullName
    }
    property {
      id
      addressLine1
    }
    service {
      id
      name
    }
    team {
      id
      name
    }
  }
}
    `;

/**
 * __useBookingQuery__
 *
 * To run a query within a React component, call `useBookingQuery` and pass it any options that fit your needs.
 * When your component renders, `useBookingQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useBookingQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useBookingQuery(baseOptions: Apollo.QueryHookOptions<BookingQuery, BookingQueryVariables> & ({ variables: BookingQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<BookingQuery, BookingQueryVariables>(BookingDocument, options);
      }
export function useBookingLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<BookingQuery, BookingQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<BookingQuery, BookingQueryVariables>(BookingDocument, options);
        }
// @ts-ignore
export function useBookingSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<BookingQuery, BookingQueryVariables>): Apollo.UseSuspenseQueryResult<BookingQuery, BookingQueryVariables>;
export function useBookingSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<BookingQuery, BookingQueryVariables>): Apollo.UseSuspenseQueryResult<BookingQuery | undefined, BookingQueryVariables>;
export function useBookingSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<BookingQuery, BookingQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<BookingQuery, BookingQueryVariables>(BookingDocument, options);
        }
export type BookingQueryHookResult = ReturnType<typeof useBookingQuery>;
export type BookingLazyQueryHookResult = ReturnType<typeof useBookingLazyQuery>;
export type BookingSuspenseQueryHookResult = ReturnType<typeof useBookingSuspenseQuery>;
export type BookingQueryResult = Apollo.QueryResult<BookingQuery, BookingQueryVariables>;
export const CreateBookingDocument = gql`
    mutation CreateBooking($createBookingInput: CreateBookingInput!) {
  createBooking(createBookingInput: $createBookingInput) {
    id
  }
}
    `;
export type CreateBookingMutationFn = Apollo.MutationFunction<CreateBookingMutation, CreateBookingMutationVariables>;

/**
 * __useCreateBookingMutation__
 *
 * To run a mutation, you first call `useCreateBookingMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateBookingMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createBookingMutation, { data, loading, error }] = useCreateBookingMutation({
 *   variables: {
 *      createBookingInput: // value for 'createBookingInput'
 *   },
 * });
 */
export function useCreateBookingMutation(baseOptions?: Apollo.MutationHookOptions<CreateBookingMutation, CreateBookingMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateBookingMutation, CreateBookingMutationVariables>(CreateBookingDocument, options);
      }
export type CreateBookingMutationHookResult = ReturnType<typeof useCreateBookingMutation>;
export type CreateBookingMutationResult = Apollo.MutationResult<CreateBookingMutation>;
export type CreateBookingMutationOptions = Apollo.BaseMutationOptions<CreateBookingMutation, CreateBookingMutationVariables>;
export const UpdateBookingDocument = gql`
    mutation UpdateBooking($updateBookingInput: UpdateBookingInput!) {
  updateBooking(updateBookingInput: $updateBookingInput) {
    id
  }
}
    `;
export type UpdateBookingMutationFn = Apollo.MutationFunction<UpdateBookingMutation, UpdateBookingMutationVariables>;

/**
 * __useUpdateBookingMutation__
 *
 * To run a mutation, you first call `useUpdateBookingMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateBookingMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateBookingMutation, { data, loading, error }] = useUpdateBookingMutation({
 *   variables: {
 *      updateBookingInput: // value for 'updateBookingInput'
 *   },
 * });
 */
export function useUpdateBookingMutation(baseOptions?: Apollo.MutationHookOptions<UpdateBookingMutation, UpdateBookingMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateBookingMutation, UpdateBookingMutationVariables>(UpdateBookingDocument, options);
      }
export type UpdateBookingMutationHookResult = ReturnType<typeof useUpdateBookingMutation>;
export type UpdateBookingMutationResult = Apollo.MutationResult<UpdateBookingMutation>;
export type UpdateBookingMutationOptions = Apollo.BaseMutationOptions<UpdateBookingMutation, UpdateBookingMutationVariables>;
export const RemoveBookingDocument = gql`
    mutation RemoveBooking($id: ID!) {
  removeBooking(id: $id) {
    id
  }
}
    `;
export type RemoveBookingMutationFn = Apollo.MutationFunction<RemoveBookingMutation, RemoveBookingMutationVariables>;

/**
 * __useRemoveBookingMutation__
 *
 * To run a mutation, you first call `useRemoveBookingMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useRemoveBookingMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [removeBookingMutation, { data, loading, error }] = useRemoveBookingMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useRemoveBookingMutation(baseOptions?: Apollo.MutationHookOptions<RemoveBookingMutation, RemoveBookingMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<RemoveBookingMutation, RemoveBookingMutationVariables>(RemoveBookingDocument, options);
      }
export type RemoveBookingMutationHookResult = ReturnType<typeof useRemoveBookingMutation>;
export type RemoveBookingMutationResult = Apollo.MutationResult<RemoveBookingMutation>;
export type RemoveBookingMutationOptions = Apollo.BaseMutationOptions<RemoveBookingMutation, RemoveBookingMutationVariables>;
export const CleanersDocument = gql`
    query Cleaners($paging: OffsetPaging, $filter: CleanerFilter, $sorting: [CleanerSort!]) {
  cleaners(paging: $paging, filter: $filter, sorting: $sorting) {
    totalCount
    pageInfo {
      hasNextPage
      hasPreviousPage
    }
    nodes {
      id
      fullName
      phone
      email
      team {
        id
        name
      }
    }
  }
}
    `;

/**
 * __useCleanersQuery__
 *
 * To run a query within a React component, call `useCleanersQuery` and pass it any options that fit your needs.
 * When your component renders, `useCleanersQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useCleanersQuery({
 *   variables: {
 *      paging: // value for 'paging'
 *      filter: // value for 'filter'
 *      sorting: // value for 'sorting'
 *   },
 * });
 */
export function useCleanersQuery(baseOptions?: Apollo.QueryHookOptions<CleanersQuery, CleanersQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<CleanersQuery, CleanersQueryVariables>(CleanersDocument, options);
      }
export function useCleanersLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<CleanersQuery, CleanersQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<CleanersQuery, CleanersQueryVariables>(CleanersDocument, options);
        }
// @ts-ignore
export function useCleanersSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<CleanersQuery, CleanersQueryVariables>): Apollo.UseSuspenseQueryResult<CleanersQuery, CleanersQueryVariables>;
export function useCleanersSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CleanersQuery, CleanersQueryVariables>): Apollo.UseSuspenseQueryResult<CleanersQuery | undefined, CleanersQueryVariables>;
export function useCleanersSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CleanersQuery, CleanersQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<CleanersQuery, CleanersQueryVariables>(CleanersDocument, options);
        }
export type CleanersQueryHookResult = ReturnType<typeof useCleanersQuery>;
export type CleanersLazyQueryHookResult = ReturnType<typeof useCleanersLazyQuery>;
export type CleanersSuspenseQueryHookResult = ReturnType<typeof useCleanersSuspenseQuery>;
export type CleanersQueryResult = Apollo.QueryResult<CleanersQuery, CleanersQueryVariables>;
export const CleanerDocument = gql`
    query Cleaner($id: ID!) {
  cleaner(id: $id) {
    id
    fullName
    phone
    email
    notes
    team {
      id
      name
    }
  }
}
    `;

/**
 * __useCleanerQuery__
 *
 * To run a query within a React component, call `useCleanerQuery` and pass it any options that fit your needs.
 * When your component renders, `useCleanerQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useCleanerQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useCleanerQuery(baseOptions: Apollo.QueryHookOptions<CleanerQuery, CleanerQueryVariables> & ({ variables: CleanerQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<CleanerQuery, CleanerQueryVariables>(CleanerDocument, options);
      }
export function useCleanerLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<CleanerQuery, CleanerQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<CleanerQuery, CleanerQueryVariables>(CleanerDocument, options);
        }
// @ts-ignore
export function useCleanerSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<CleanerQuery, CleanerQueryVariables>): Apollo.UseSuspenseQueryResult<CleanerQuery, CleanerQueryVariables>;
export function useCleanerSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CleanerQuery, CleanerQueryVariables>): Apollo.UseSuspenseQueryResult<CleanerQuery | undefined, CleanerQueryVariables>;
export function useCleanerSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CleanerQuery, CleanerQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<CleanerQuery, CleanerQueryVariables>(CleanerDocument, options);
        }
export type CleanerQueryHookResult = ReturnType<typeof useCleanerQuery>;
export type CleanerLazyQueryHookResult = ReturnType<typeof useCleanerLazyQuery>;
export type CleanerSuspenseQueryHookResult = ReturnType<typeof useCleanerSuspenseQuery>;
export type CleanerQueryResult = Apollo.QueryResult<CleanerQuery, CleanerQueryVariables>;
export const CreateCleanerDocument = gql`
    mutation CreateCleaner($input: CreateCleanerInput!) {
  createCleaner(input: $input) {
    id
  }
}
    `;
export type CreateCleanerMutationFn = Apollo.MutationFunction<CreateCleanerMutation, CreateCleanerMutationVariables>;

/**
 * __useCreateCleanerMutation__
 *
 * To run a mutation, you first call `useCreateCleanerMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateCleanerMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createCleanerMutation, { data, loading, error }] = useCreateCleanerMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateCleanerMutation(baseOptions?: Apollo.MutationHookOptions<CreateCleanerMutation, CreateCleanerMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateCleanerMutation, CreateCleanerMutationVariables>(CreateCleanerDocument, options);
      }
export type CreateCleanerMutationHookResult = ReturnType<typeof useCreateCleanerMutation>;
export type CreateCleanerMutationResult = Apollo.MutationResult<CreateCleanerMutation>;
export type CreateCleanerMutationOptions = Apollo.BaseMutationOptions<CreateCleanerMutation, CreateCleanerMutationVariables>;
export const UpdateCleanerDocument = gql`
    mutation UpdateCleaner($id: ID!, $input: UpdateCleanerInput!) {
  updateCleaner(id: $id, input: $input) {
    id
  }
}
    `;
export type UpdateCleanerMutationFn = Apollo.MutationFunction<UpdateCleanerMutation, UpdateCleanerMutationVariables>;

/**
 * __useUpdateCleanerMutation__
 *
 * To run a mutation, you first call `useUpdateCleanerMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateCleanerMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateCleanerMutation, { data, loading, error }] = useUpdateCleanerMutation({
 *   variables: {
 *      id: // value for 'id'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdateCleanerMutation(baseOptions?: Apollo.MutationHookOptions<UpdateCleanerMutation, UpdateCleanerMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateCleanerMutation, UpdateCleanerMutationVariables>(UpdateCleanerDocument, options);
      }
export type UpdateCleanerMutationHookResult = ReturnType<typeof useUpdateCleanerMutation>;
export type UpdateCleanerMutationResult = Apollo.MutationResult<UpdateCleanerMutation>;
export type UpdateCleanerMutationOptions = Apollo.BaseMutationOptions<UpdateCleanerMutation, UpdateCleanerMutationVariables>;
export const AssignCleanerToTeamDocument = gql`
    mutation AssignCleanerToTeam($cleanerId: ID!, $teamId: ID!) {
  assignCleanerToTeam(cleanerId: $cleanerId, teamId: $teamId) {
    id
  }
}
    `;
export type AssignCleanerToTeamMutationFn = Apollo.MutationFunction<AssignCleanerToTeamMutation, AssignCleanerToTeamMutationVariables>;

/**
 * __useAssignCleanerToTeamMutation__
 *
 * To run a mutation, you first call `useAssignCleanerToTeamMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useAssignCleanerToTeamMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [assignCleanerToTeamMutation, { data, loading, error }] = useAssignCleanerToTeamMutation({
 *   variables: {
 *      cleanerId: // value for 'cleanerId'
 *      teamId: // value for 'teamId'
 *   },
 * });
 */
export function useAssignCleanerToTeamMutation(baseOptions?: Apollo.MutationHookOptions<AssignCleanerToTeamMutation, AssignCleanerToTeamMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<AssignCleanerToTeamMutation, AssignCleanerToTeamMutationVariables>(AssignCleanerToTeamDocument, options);
      }
export type AssignCleanerToTeamMutationHookResult = ReturnType<typeof useAssignCleanerToTeamMutation>;
export type AssignCleanerToTeamMutationResult = Apollo.MutationResult<AssignCleanerToTeamMutation>;
export type AssignCleanerToTeamMutationOptions = Apollo.BaseMutationOptions<AssignCleanerToTeamMutation, AssignCleanerToTeamMutationVariables>;
export const CreateAdminDocument = gql`
    mutation CreateAdmin($createAdminInput: CreateAdminInput!) {
  createAdmin(createAdminInput: $createAdminInput) {
    id
    email
    role
    isActive
  }
}
    `;
export type CreateAdminMutationFn = Apollo.MutationFunction<CreateAdminMutation, CreateAdminMutationVariables>;

/**
 * __useCreateAdminMutation__
 *
 * To run a mutation, you first call `useCreateAdminMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateAdminMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createAdminMutation, { data, loading, error }] = useCreateAdminMutation({
 *   variables: {
 *      createAdminInput: // value for 'createAdminInput'
 *   },
 * });
 */
export function useCreateAdminMutation(baseOptions?: Apollo.MutationHookOptions<CreateAdminMutation, CreateAdminMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateAdminMutation, CreateAdminMutationVariables>(CreateAdminDocument, options);
      }
export type CreateAdminMutationHookResult = ReturnType<typeof useCreateAdminMutation>;
export type CreateAdminMutationResult = Apollo.MutationResult<CreateAdminMutation>;
export type CreateAdminMutationOptions = Apollo.BaseMutationOptions<CreateAdminMutation, CreateAdminMutationVariables>;
export const CurrentAdminDocument = gql`
    query CurrentAdmin {
  currentAdmin {
    id
    role
  }
}
    `;

/**
 * __useCurrentAdminQuery__
 *
 * To run a query within a React component, call `useCurrentAdminQuery` and pass it any options that fit your needs.
 * When your component renders, `useCurrentAdminQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useCurrentAdminQuery({
 *   variables: {
 *   },
 * });
 */
export function useCurrentAdminQuery(baseOptions?: Apollo.QueryHookOptions<CurrentAdminQuery, CurrentAdminQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<CurrentAdminQuery, CurrentAdminQueryVariables>(CurrentAdminDocument, options);
      }
export function useCurrentAdminLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<CurrentAdminQuery, CurrentAdminQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<CurrentAdminQuery, CurrentAdminQueryVariables>(CurrentAdminDocument, options);
        }
// @ts-ignore
export function useCurrentAdminSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<CurrentAdminQuery, CurrentAdminQueryVariables>): Apollo.UseSuspenseQueryResult<CurrentAdminQuery, CurrentAdminQueryVariables>;
export function useCurrentAdminSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CurrentAdminQuery, CurrentAdminQueryVariables>): Apollo.UseSuspenseQueryResult<CurrentAdminQuery | undefined, CurrentAdminQueryVariables>;
export function useCurrentAdminSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CurrentAdminQuery, CurrentAdminQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<CurrentAdminQuery, CurrentAdminQueryVariables>(CurrentAdminDocument, options);
        }
export type CurrentAdminQueryHookResult = ReturnType<typeof useCurrentAdminQuery>;
export type CurrentAdminLazyQueryHookResult = ReturnType<typeof useCurrentAdminLazyQuery>;
export type CurrentAdminSuspenseQueryHookResult = ReturnType<typeof useCurrentAdminSuspenseQuery>;
export type CurrentAdminQueryResult = Apollo.QueryResult<CurrentAdminQuery, CurrentAdminQueryVariables>;
export const CustomersDocument = gql`
    query Customers($paging: OffsetPaging, $filter: CustomerFilter, $sorting: [CustomerSort!]) {
  customers(paging: $paging, filter: $filter, sorting: $sorting) {
    totalCount
    pageInfo {
      hasNextPage
      hasPreviousPage
    }
    nodes {
      id
      fullName
      email
      phone
    }
  }
}
    `;

/**
 * __useCustomersQuery__
 *
 * To run a query within a React component, call `useCustomersQuery` and pass it any options that fit your needs.
 * When your component renders, `useCustomersQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useCustomersQuery({
 *   variables: {
 *      paging: // value for 'paging'
 *      filter: // value for 'filter'
 *      sorting: // value for 'sorting'
 *   },
 * });
 */
export function useCustomersQuery(baseOptions?: Apollo.QueryHookOptions<CustomersQuery, CustomersQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<CustomersQuery, CustomersQueryVariables>(CustomersDocument, options);
      }
export function useCustomersLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<CustomersQuery, CustomersQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<CustomersQuery, CustomersQueryVariables>(CustomersDocument, options);
        }
// @ts-ignore
export function useCustomersSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<CustomersQuery, CustomersQueryVariables>): Apollo.UseSuspenseQueryResult<CustomersQuery, CustomersQueryVariables>;
export function useCustomersSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CustomersQuery, CustomersQueryVariables>): Apollo.UseSuspenseQueryResult<CustomersQuery | undefined, CustomersQueryVariables>;
export function useCustomersSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CustomersQuery, CustomersQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<CustomersQuery, CustomersQueryVariables>(CustomersDocument, options);
        }
export type CustomersQueryHookResult = ReturnType<typeof useCustomersQuery>;
export type CustomersLazyQueryHookResult = ReturnType<typeof useCustomersLazyQuery>;
export type CustomersSuspenseQueryHookResult = ReturnType<typeof useCustomersSuspenseQuery>;
export type CustomersQueryResult = Apollo.QueryResult<CustomersQuery, CustomersQueryVariables>;
export const CustomerDocument = gql`
    query Customer($id: ID!) {
  customer(id: $id) {
    id
    fullName
    email
    phone
    notes
    properties(paging: { limit: 100 }) {
      nodes {
        id
        label
        addressLine1
        addressLine2
        city
        region
        postalCode
        accessNotes
      }
      pageInfo {
        hasNextPage
      }
    }
  }
}
    `;

/**
 * __useCustomerQuery__
 *
 * To run a query within a React component, call `useCustomerQuery` and pass it any options that fit your needs.
 * When your component renders, `useCustomerQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useCustomerQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useCustomerQuery(baseOptions: Apollo.QueryHookOptions<CustomerQuery, CustomerQueryVariables> & ({ variables: CustomerQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<CustomerQuery, CustomerQueryVariables>(CustomerDocument, options);
      }
export function useCustomerLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<CustomerQuery, CustomerQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<CustomerQuery, CustomerQueryVariables>(CustomerDocument, options);
        }
// @ts-ignore
export function useCustomerSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<CustomerQuery, CustomerQueryVariables>): Apollo.UseSuspenseQueryResult<CustomerQuery, CustomerQueryVariables>;
export function useCustomerSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CustomerQuery, CustomerQueryVariables>): Apollo.UseSuspenseQueryResult<CustomerQuery | undefined, CustomerQueryVariables>;
export function useCustomerSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CustomerQuery, CustomerQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<CustomerQuery, CustomerQueryVariables>(CustomerDocument, options);
        }
export type CustomerQueryHookResult = ReturnType<typeof useCustomerQuery>;
export type CustomerLazyQueryHookResult = ReturnType<typeof useCustomerLazyQuery>;
export type CustomerSuspenseQueryHookResult = ReturnType<typeof useCustomerSuspenseQuery>;
export type CustomerQueryResult = Apollo.QueryResult<CustomerQuery, CustomerQueryVariables>;
export const CreateCustomerDocument = gql`
    mutation CreateCustomer($input: CreateCustomerInput!) {
  createCustomer(input: $input) {
    id
  }
}
    `;
export type CreateCustomerMutationFn = Apollo.MutationFunction<CreateCustomerMutation, CreateCustomerMutationVariables>;

/**
 * __useCreateCustomerMutation__
 *
 * To run a mutation, you first call `useCreateCustomerMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateCustomerMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createCustomerMutation, { data, loading, error }] = useCreateCustomerMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateCustomerMutation(baseOptions?: Apollo.MutationHookOptions<CreateCustomerMutation, CreateCustomerMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateCustomerMutation, CreateCustomerMutationVariables>(CreateCustomerDocument, options);
      }
export type CreateCustomerMutationHookResult = ReturnType<typeof useCreateCustomerMutation>;
export type CreateCustomerMutationResult = Apollo.MutationResult<CreateCustomerMutation>;
export type CreateCustomerMutationOptions = Apollo.BaseMutationOptions<CreateCustomerMutation, CreateCustomerMutationVariables>;
export const UpdateCustomerDocument = gql`
    mutation UpdateCustomer($id: ID!, $input: UpdateCustomerInput!) {
  updateCustomer(id: $id, input: $input) {
    id
  }
}
    `;
export type UpdateCustomerMutationFn = Apollo.MutationFunction<UpdateCustomerMutation, UpdateCustomerMutationVariables>;

/**
 * __useUpdateCustomerMutation__
 *
 * To run a mutation, you first call `useUpdateCustomerMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateCustomerMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateCustomerMutation, { data, loading, error }] = useUpdateCustomerMutation({
 *   variables: {
 *      id: // value for 'id'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdateCustomerMutation(baseOptions?: Apollo.MutationHookOptions<UpdateCustomerMutation, UpdateCustomerMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateCustomerMutation, UpdateCustomerMutationVariables>(UpdateCustomerDocument, options);
      }
export type UpdateCustomerMutationHookResult = ReturnType<typeof useUpdateCustomerMutation>;
export type UpdateCustomerMutationResult = Apollo.MutationResult<UpdateCustomerMutation>;
export type UpdateCustomerMutationOptions = Apollo.BaseMutationOptions<UpdateCustomerMutation, UpdateCustomerMutationVariables>;
export const DisableAdminDocument = gql`
    mutation DisableAdmin($id: ID!) {
  disableAdmin(id: $id) {
    id
    email
    role
    isActive
  }
}
    `;
export type DisableAdminMutationFn = Apollo.MutationFunction<DisableAdminMutation, DisableAdminMutationVariables>;

/**
 * __useDisableAdminMutation__
 *
 * To run a mutation, you first call `useDisableAdminMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDisableAdminMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [disableAdminMutation, { data, loading, error }] = useDisableAdminMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDisableAdminMutation(baseOptions?: Apollo.MutationHookOptions<DisableAdminMutation, DisableAdminMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DisableAdminMutation, DisableAdminMutationVariables>(DisableAdminDocument, options);
      }
export type DisableAdminMutationHookResult = ReturnType<typeof useDisableAdminMutation>;
export type DisableAdminMutationResult = Apollo.MutationResult<DisableAdminMutation>;
export type DisableAdminMutationOptions = Apollo.BaseMutationOptions<DisableAdminMutation, DisableAdminMutationVariables>;
export const JobsDocument = gql`
    query Jobs($paging: OffsetPaging, $filter: CleaningJobFilter, $sorting: [CleaningJobSort!]) {
  jobs(paging: $paging, filter: $filter, sorting: $sorting) {
    totalCount
    pageInfo {
      hasNextPage
      hasPreviousPage
    }
    nodes {
      ...JobFields
    }
  }
}
    ${JobFieldsFragmentDoc}`;

/**
 * __useJobsQuery__
 *
 * To run a query within a React component, call `useJobsQuery` and pass it any options that fit your needs.
 * When your component renders, `useJobsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useJobsQuery({
 *   variables: {
 *      paging: // value for 'paging'
 *      filter: // value for 'filter'
 *      sorting: // value for 'sorting'
 *   },
 * });
 */
export function useJobsQuery(baseOptions?: Apollo.QueryHookOptions<JobsQuery, JobsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<JobsQuery, JobsQueryVariables>(JobsDocument, options);
      }
export function useJobsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<JobsQuery, JobsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<JobsQuery, JobsQueryVariables>(JobsDocument, options);
        }
// @ts-ignore
export function useJobsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<JobsQuery, JobsQueryVariables>): Apollo.UseSuspenseQueryResult<JobsQuery, JobsQueryVariables>;
export function useJobsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<JobsQuery, JobsQueryVariables>): Apollo.UseSuspenseQueryResult<JobsQuery | undefined, JobsQueryVariables>;
export function useJobsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<JobsQuery, JobsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<JobsQuery, JobsQueryVariables>(JobsDocument, options);
        }
export type JobsQueryHookResult = ReturnType<typeof useJobsQuery>;
export type JobsLazyQueryHookResult = ReturnType<typeof useJobsLazyQuery>;
export type JobsSuspenseQueryHookResult = ReturnType<typeof useJobsSuspenseQuery>;
export type JobsQueryResult = Apollo.QueryResult<JobsQuery, JobsQueryVariables>;
export const JobDocument = gql`
    query Job($id: ID!) {
  job(id: $id) {
    ...JobFields
  }
}
    ${JobFieldsFragmentDoc}`;

/**
 * __useJobQuery__
 *
 * To run a query within a React component, call `useJobQuery` and pass it any options that fit your needs.
 * When your component renders, `useJobQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useJobQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useJobQuery(baseOptions: Apollo.QueryHookOptions<JobQuery, JobQueryVariables> & ({ variables: JobQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<JobQuery, JobQueryVariables>(JobDocument, options);
      }
export function useJobLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<JobQuery, JobQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<JobQuery, JobQueryVariables>(JobDocument, options);
        }
// @ts-ignore
export function useJobSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<JobQuery, JobQueryVariables>): Apollo.UseSuspenseQueryResult<JobQuery, JobQueryVariables>;
export function useJobSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<JobQuery, JobQueryVariables>): Apollo.UseSuspenseQueryResult<JobQuery | undefined, JobQueryVariables>;
export function useJobSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<JobQuery, JobQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<JobQuery, JobQueryVariables>(JobDocument, options);
        }
export type JobQueryHookResult = ReturnType<typeof useJobQuery>;
export type JobLazyQueryHookResult = ReturnType<typeof useJobLazyQuery>;
export type JobSuspenseQueryHookResult = ReturnType<typeof useJobSuspenseQuery>;
export type JobQueryResult = Apollo.QueryResult<JobQuery, JobQueryVariables>;
export const JobByBookingDocument = gql`
    query JobByBooking($bookingId: ID!) {
  jobs(filter: { booking: { id: { eq: $bookingId } } }, paging: { limit: 1 }) {
    nodes {
      id
    }
  }
}
    `;

/**
 * __useJobByBookingQuery__
 *
 * To run a query within a React component, call `useJobByBookingQuery` and pass it any options that fit your needs.
 * When your component renders, `useJobByBookingQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useJobByBookingQuery({
 *   variables: {
 *      bookingId: // value for 'bookingId'
 *   },
 * });
 */
export function useJobByBookingQuery(baseOptions: Apollo.QueryHookOptions<JobByBookingQuery, JobByBookingQueryVariables> & ({ variables: JobByBookingQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<JobByBookingQuery, JobByBookingQueryVariables>(JobByBookingDocument, options);
      }
export function useJobByBookingLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<JobByBookingQuery, JobByBookingQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<JobByBookingQuery, JobByBookingQueryVariables>(JobByBookingDocument, options);
        }
// @ts-ignore
export function useJobByBookingSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<JobByBookingQuery, JobByBookingQueryVariables>): Apollo.UseSuspenseQueryResult<JobByBookingQuery, JobByBookingQueryVariables>;
export function useJobByBookingSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<JobByBookingQuery, JobByBookingQueryVariables>): Apollo.UseSuspenseQueryResult<JobByBookingQuery | undefined, JobByBookingQueryVariables>;
export function useJobByBookingSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<JobByBookingQuery, JobByBookingQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<JobByBookingQuery, JobByBookingQueryVariables>(JobByBookingDocument, options);
        }
export type JobByBookingQueryHookResult = ReturnType<typeof useJobByBookingQuery>;
export type JobByBookingLazyQueryHookResult = ReturnType<typeof useJobByBookingLazyQuery>;
export type JobByBookingSuspenseQueryHookResult = ReturnType<typeof useJobByBookingSuspenseQuery>;
export type JobByBookingQueryResult = Apollo.QueryResult<JobByBookingQuery, JobByBookingQueryVariables>;
export const CreateJobFromBookingDocument = gql`
    mutation CreateJobFromBooking($input: CreateJobFromBookingInput!) {
  createJobFromBooking(input: $input) {
    ...JobFields
  }
}
    ${JobFieldsFragmentDoc}`;
export type CreateJobFromBookingMutationFn = Apollo.MutationFunction<CreateJobFromBookingMutation, CreateJobFromBookingMutationVariables>;

/**
 * __useCreateJobFromBookingMutation__
 *
 * To run a mutation, you first call `useCreateJobFromBookingMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateJobFromBookingMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createJobFromBookingMutation, { data, loading, error }] = useCreateJobFromBookingMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateJobFromBookingMutation(baseOptions?: Apollo.MutationHookOptions<CreateJobFromBookingMutation, CreateJobFromBookingMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateJobFromBookingMutation, CreateJobFromBookingMutationVariables>(CreateJobFromBookingDocument, options);
      }
export type CreateJobFromBookingMutationHookResult = ReturnType<typeof useCreateJobFromBookingMutation>;
export type CreateJobFromBookingMutationResult = Apollo.MutationResult<CreateJobFromBookingMutation>;
export type CreateJobFromBookingMutationOptions = Apollo.BaseMutationOptions<CreateJobFromBookingMutation, CreateJobFromBookingMutationVariables>;
export const AssignTeamToJobDocument = gql`
    mutation AssignTeamToJob($input: AssignTeamToJobInput!) {
  assignTeamToJob(input: $input) {
    ...JobFields
  }
}
    ${JobFieldsFragmentDoc}`;
export type AssignTeamToJobMutationFn = Apollo.MutationFunction<AssignTeamToJobMutation, AssignTeamToJobMutationVariables>;

/**
 * __useAssignTeamToJobMutation__
 *
 * To run a mutation, you first call `useAssignTeamToJobMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useAssignTeamToJobMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [assignTeamToJobMutation, { data, loading, error }] = useAssignTeamToJobMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useAssignTeamToJobMutation(baseOptions?: Apollo.MutationHookOptions<AssignTeamToJobMutation, AssignTeamToJobMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<AssignTeamToJobMutation, AssignTeamToJobMutationVariables>(AssignTeamToJobDocument, options);
      }
export type AssignTeamToJobMutationHookResult = ReturnType<typeof useAssignTeamToJobMutation>;
export type AssignTeamToJobMutationResult = Apollo.MutationResult<AssignTeamToJobMutation>;
export type AssignTeamToJobMutationOptions = Apollo.BaseMutationOptions<AssignTeamToJobMutation, AssignTeamToJobMutationVariables>;
export const CompleteChecklistItemDocument = gql`
    mutation CompleteChecklistItem($input: CompleteChecklistItemInput!) {
  completeChecklistItem(input: $input) {
    ...JobFields
  }
}
    ${JobFieldsFragmentDoc}`;
export type CompleteChecklistItemMutationFn = Apollo.MutationFunction<CompleteChecklistItemMutation, CompleteChecklistItemMutationVariables>;

/**
 * __useCompleteChecklistItemMutation__
 *
 * To run a mutation, you first call `useCompleteChecklistItemMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCompleteChecklistItemMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [completeChecklistItemMutation, { data, loading, error }] = useCompleteChecklistItemMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCompleteChecklistItemMutation(baseOptions?: Apollo.MutationHookOptions<CompleteChecklistItemMutation, CompleteChecklistItemMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CompleteChecklistItemMutation, CompleteChecklistItemMutationVariables>(CompleteChecklistItemDocument, options);
      }
export type CompleteChecklistItemMutationHookResult = ReturnType<typeof useCompleteChecklistItemMutation>;
export type CompleteChecklistItemMutationResult = Apollo.MutationResult<CompleteChecklistItemMutation>;
export type CompleteChecklistItemMutationOptions = Apollo.BaseMutationOptions<CompleteChecklistItemMutation, CompleteChecklistItemMutationVariables>;
export const CompleteJobDocument = gql`
    mutation CompleteJob($input: CompleteJobInput!) {
  completeJob(input: $input) {
    ...JobFields
  }
}
    ${JobFieldsFragmentDoc}`;
export type CompleteJobMutationFn = Apollo.MutationFunction<CompleteJobMutation, CompleteJobMutationVariables>;

/**
 * __useCompleteJobMutation__
 *
 * To run a mutation, you first call `useCompleteJobMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCompleteJobMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [completeJobMutation, { data, loading, error }] = useCompleteJobMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCompleteJobMutation(baseOptions?: Apollo.MutationHookOptions<CompleteJobMutation, CompleteJobMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CompleteJobMutation, CompleteJobMutationVariables>(CompleteJobDocument, options);
      }
export type CompleteJobMutationHookResult = ReturnType<typeof useCompleteJobMutation>;
export type CompleteJobMutationResult = Apollo.MutationResult<CompleteJobMutation>;
export type CompleteJobMutationOptions = Apollo.BaseMutationOptions<CompleteJobMutation, CompleteJobMutationVariables>;
export const LoginDocument = gql`
    mutation Login($loginInput: LoginInput!) {
  login(loginInput: $loginInput) {
    success
    admin {
      id
      role
    }
  }
}
    `;
export type LoginMutationFn = Apollo.MutationFunction<LoginMutation, LoginMutationVariables>;

/**
 * __useLoginMutation__
 *
 * To run a mutation, you first call `useLoginMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useLoginMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [loginMutation, { data, loading, error }] = useLoginMutation({
 *   variables: {
 *      loginInput: // value for 'loginInput'
 *   },
 * });
 */
export function useLoginMutation(baseOptions?: Apollo.MutationHookOptions<LoginMutation, LoginMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<LoginMutation, LoginMutationVariables>(LoginDocument, options);
      }
export type LoginMutationHookResult = ReturnType<typeof useLoginMutation>;
export type LoginMutationResult = Apollo.MutationResult<LoginMutation>;
export type LoginMutationOptions = Apollo.BaseMutationOptions<LoginMutation, LoginMutationVariables>;
export const LogoutDocument = gql`
    mutation Logout {
  logout
}
    `;
export type LogoutMutationFn = Apollo.MutationFunction<LogoutMutation, LogoutMutationVariables>;

/**
 * __useLogoutMutation__
 *
 * To run a mutation, you first call `useLogoutMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useLogoutMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [logoutMutation, { data, loading, error }] = useLogoutMutation({
 *   variables: {
 *   },
 * });
 */
export function useLogoutMutation(baseOptions?: Apollo.MutationHookOptions<LogoutMutation, LogoutMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<LogoutMutation, LogoutMutationVariables>(LogoutDocument, options);
      }
export type LogoutMutationHookResult = ReturnType<typeof useLogoutMutation>;
export type LogoutMutationResult = Apollo.MutationResult<LogoutMutation>;
export type LogoutMutationOptions = Apollo.BaseMutationOptions<LogoutMutation, LogoutMutationVariables>;
export const CustomerPropertiesDocument = gql`
    query CustomerProperties($customerId: ID!, $paging: OffsetPaging, $filter: PropertyFilter) {
  customerProperties(customerId: $customerId, paging: $paging, filter: $filter) {
    totalCount
    pageInfo {
      hasNextPage
      hasPreviousPage
    }
    nodes {
      id
      label
      addressLine1
    }
  }
}
    `;

/**
 * __useCustomerPropertiesQuery__
 *
 * To run a query within a React component, call `useCustomerPropertiesQuery` and pass it any options that fit your needs.
 * When your component renders, `useCustomerPropertiesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useCustomerPropertiesQuery({
 *   variables: {
 *      customerId: // value for 'customerId'
 *      paging: // value for 'paging'
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useCustomerPropertiesQuery(baseOptions: Apollo.QueryHookOptions<CustomerPropertiesQuery, CustomerPropertiesQueryVariables> & ({ variables: CustomerPropertiesQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<CustomerPropertiesQuery, CustomerPropertiesQueryVariables>(CustomerPropertiesDocument, options);
      }
export function useCustomerPropertiesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<CustomerPropertiesQuery, CustomerPropertiesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<CustomerPropertiesQuery, CustomerPropertiesQueryVariables>(CustomerPropertiesDocument, options);
        }
// @ts-ignore
export function useCustomerPropertiesSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<CustomerPropertiesQuery, CustomerPropertiesQueryVariables>): Apollo.UseSuspenseQueryResult<CustomerPropertiesQuery, CustomerPropertiesQueryVariables>;
export function useCustomerPropertiesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CustomerPropertiesQuery, CustomerPropertiesQueryVariables>): Apollo.UseSuspenseQueryResult<CustomerPropertiesQuery | undefined, CustomerPropertiesQueryVariables>;
export function useCustomerPropertiesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CustomerPropertiesQuery, CustomerPropertiesQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<CustomerPropertiesQuery, CustomerPropertiesQueryVariables>(CustomerPropertiesDocument, options);
        }
export type CustomerPropertiesQueryHookResult = ReturnType<typeof useCustomerPropertiesQuery>;
export type CustomerPropertiesLazyQueryHookResult = ReturnType<typeof useCustomerPropertiesLazyQuery>;
export type CustomerPropertiesSuspenseQueryHookResult = ReturnType<typeof useCustomerPropertiesSuspenseQuery>;
export type CustomerPropertiesQueryResult = Apollo.QueryResult<CustomerPropertiesQuery, CustomerPropertiesQueryVariables>;
export const CreatePropertyDocument = gql`
    mutation CreateProperty($customerId: ID!, $input: CreatePropertyInput!) {
  createProperty(customerId: $customerId, input: $input) {
    id
  }
}
    `;
export type CreatePropertyMutationFn = Apollo.MutationFunction<CreatePropertyMutation, CreatePropertyMutationVariables>;

/**
 * __useCreatePropertyMutation__
 *
 * To run a mutation, you first call `useCreatePropertyMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreatePropertyMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createPropertyMutation, { data, loading, error }] = useCreatePropertyMutation({
 *   variables: {
 *      customerId: // value for 'customerId'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreatePropertyMutation(baseOptions?: Apollo.MutationHookOptions<CreatePropertyMutation, CreatePropertyMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreatePropertyMutation, CreatePropertyMutationVariables>(CreatePropertyDocument, options);
      }
export type CreatePropertyMutationHookResult = ReturnType<typeof useCreatePropertyMutation>;
export type CreatePropertyMutationResult = Apollo.MutationResult<CreatePropertyMutation>;
export type CreatePropertyMutationOptions = Apollo.BaseMutationOptions<CreatePropertyMutation, CreatePropertyMutationVariables>;
export const UpdatePropertyDocument = gql`
    mutation UpdateProperty($id: ID!, $input: UpdatePropertyInput!) {
  updateProperty(id: $id, input: $input) {
    id
  }
}
    `;
export type UpdatePropertyMutationFn = Apollo.MutationFunction<UpdatePropertyMutation, UpdatePropertyMutationVariables>;

/**
 * __useUpdatePropertyMutation__
 *
 * To run a mutation, you first call `useUpdatePropertyMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdatePropertyMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updatePropertyMutation, { data, loading, error }] = useUpdatePropertyMutation({
 *   variables: {
 *      id: // value for 'id'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdatePropertyMutation(baseOptions?: Apollo.MutationHookOptions<UpdatePropertyMutation, UpdatePropertyMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdatePropertyMutation, UpdatePropertyMutationVariables>(UpdatePropertyDocument, options);
      }
export type UpdatePropertyMutationHookResult = ReturnType<typeof useUpdatePropertyMutation>;
export type UpdatePropertyMutationResult = Apollo.MutationResult<UpdatePropertyMutation>;
export type UpdatePropertyMutationOptions = Apollo.BaseMutationOptions<UpdatePropertyMutation, UpdatePropertyMutationVariables>;
export const ServicesDocument = gql`
    query Services($paging: OffsetPaging, $filter: ServiceFilter, $sorting: [ServiceSort!]) {
  services(paging: $paging, filter: $filter, sorting: $sorting) {
    totalCount
    pageInfo {
      hasNextPage
      hasPreviousPage
    }
    nodes {
      id
      name
      durationMinutes
      active
      activePricing {
        priceMinorUnits
      }
    }
  }
}
    `;

/**
 * __useServicesQuery__
 *
 * To run a query within a React component, call `useServicesQuery` and pass it any options that fit your needs.
 * When your component renders, `useServicesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useServicesQuery({
 *   variables: {
 *      paging: // value for 'paging'
 *      filter: // value for 'filter'
 *      sorting: // value for 'sorting'
 *   },
 * });
 */
export function useServicesQuery(baseOptions?: Apollo.QueryHookOptions<ServicesQuery, ServicesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<ServicesQuery, ServicesQueryVariables>(ServicesDocument, options);
      }
export function useServicesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ServicesQuery, ServicesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<ServicesQuery, ServicesQueryVariables>(ServicesDocument, options);
        }
// @ts-ignore
export function useServicesSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<ServicesQuery, ServicesQueryVariables>): Apollo.UseSuspenseQueryResult<ServicesQuery, ServicesQueryVariables>;
export function useServicesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ServicesQuery, ServicesQueryVariables>): Apollo.UseSuspenseQueryResult<ServicesQuery | undefined, ServicesQueryVariables>;
export function useServicesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ServicesQuery, ServicesQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<ServicesQuery, ServicesQueryVariables>(ServicesDocument, options);
        }
export type ServicesQueryHookResult = ReturnType<typeof useServicesQuery>;
export type ServicesLazyQueryHookResult = ReturnType<typeof useServicesLazyQuery>;
export type ServicesSuspenseQueryHookResult = ReturnType<typeof useServicesSuspenseQuery>;
export type ServicesQueryResult = Apollo.QueryResult<ServicesQuery, ServicesQueryVariables>;
export const ServiceDocument = gql`
    query Service($id: ID!) {
  service(id: $id) {
    id
    name
    description
    durationMinutes
    active
    activePricing {
      id
      priceMinorUnits
    }
  }
}
    `;

/**
 * __useServiceQuery__
 *
 * To run a query within a React component, call `useServiceQuery` and pass it any options that fit your needs.
 * When your component renders, `useServiceQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useServiceQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useServiceQuery(baseOptions: Apollo.QueryHookOptions<ServiceQuery, ServiceQueryVariables> & ({ variables: ServiceQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<ServiceQuery, ServiceQueryVariables>(ServiceDocument, options);
      }
export function useServiceLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ServiceQuery, ServiceQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<ServiceQuery, ServiceQueryVariables>(ServiceDocument, options);
        }
// @ts-ignore
export function useServiceSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<ServiceQuery, ServiceQueryVariables>): Apollo.UseSuspenseQueryResult<ServiceQuery, ServiceQueryVariables>;
export function useServiceSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ServiceQuery, ServiceQueryVariables>): Apollo.UseSuspenseQueryResult<ServiceQuery | undefined, ServiceQueryVariables>;
export function useServiceSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ServiceQuery, ServiceQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<ServiceQuery, ServiceQueryVariables>(ServiceDocument, options);
        }
export type ServiceQueryHookResult = ReturnType<typeof useServiceQuery>;
export type ServiceLazyQueryHookResult = ReturnType<typeof useServiceLazyQuery>;
export type ServiceSuspenseQueryHookResult = ReturnType<typeof useServiceSuspenseQuery>;
export type ServiceQueryResult = Apollo.QueryResult<ServiceQuery, ServiceQueryVariables>;
export const CreateServiceDocument = gql`
    mutation CreateService($input: CreateServiceInput!) {
  createService(input: $input) {
    id
  }
}
    `;
export type CreateServiceMutationFn = Apollo.MutationFunction<CreateServiceMutation, CreateServiceMutationVariables>;

/**
 * __useCreateServiceMutation__
 *
 * To run a mutation, you first call `useCreateServiceMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateServiceMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createServiceMutation, { data, loading, error }] = useCreateServiceMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateServiceMutation(baseOptions?: Apollo.MutationHookOptions<CreateServiceMutation, CreateServiceMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateServiceMutation, CreateServiceMutationVariables>(CreateServiceDocument, options);
      }
export type CreateServiceMutationHookResult = ReturnType<typeof useCreateServiceMutation>;
export type CreateServiceMutationResult = Apollo.MutationResult<CreateServiceMutation>;
export type CreateServiceMutationOptions = Apollo.BaseMutationOptions<CreateServiceMutation, CreateServiceMutationVariables>;
export const UpdateServiceDocument = gql`
    mutation UpdateService($id: ID!, $input: UpdateServiceInput!) {
  updateService(id: $id, input: $input) {
    id
  }
}
    `;
export type UpdateServiceMutationFn = Apollo.MutationFunction<UpdateServiceMutation, UpdateServiceMutationVariables>;

/**
 * __useUpdateServiceMutation__
 *
 * To run a mutation, you first call `useUpdateServiceMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateServiceMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateServiceMutation, { data, loading, error }] = useUpdateServiceMutation({
 *   variables: {
 *      id: // value for 'id'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdateServiceMutation(baseOptions?: Apollo.MutationHookOptions<UpdateServiceMutation, UpdateServiceMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateServiceMutation, UpdateServiceMutationVariables>(UpdateServiceDocument, options);
      }
export type UpdateServiceMutationHookResult = ReturnType<typeof useUpdateServiceMutation>;
export type UpdateServiceMutationResult = Apollo.MutationResult<UpdateServiceMutation>;
export type UpdateServiceMutationOptions = Apollo.BaseMutationOptions<UpdateServiceMutation, UpdateServiceMutationVariables>;
export const CreatePricingRuleDocument = gql`
    mutation CreatePricingRule($input: CreatePricingRuleInput!) {
  createPricingRule(input: $input) {
    id
    priceMinorUnits
  }
}
    `;
export type CreatePricingRuleMutationFn = Apollo.MutationFunction<CreatePricingRuleMutation, CreatePricingRuleMutationVariables>;

/**
 * __useCreatePricingRuleMutation__
 *
 * To run a mutation, you first call `useCreatePricingRuleMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreatePricingRuleMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createPricingRuleMutation, { data, loading, error }] = useCreatePricingRuleMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreatePricingRuleMutation(baseOptions?: Apollo.MutationHookOptions<CreatePricingRuleMutation, CreatePricingRuleMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreatePricingRuleMutation, CreatePricingRuleMutationVariables>(CreatePricingRuleDocument, options);
      }
export type CreatePricingRuleMutationHookResult = ReturnType<typeof useCreatePricingRuleMutation>;
export type CreatePricingRuleMutationResult = Apollo.MutationResult<CreatePricingRuleMutation>;
export type CreatePricingRuleMutationOptions = Apollo.BaseMutationOptions<CreatePricingRuleMutation, CreatePricingRuleMutationVariables>;
export const TeamsDocument = gql`
    query Teams($paging: OffsetPaging, $filter: TeamFilter, $sorting: [TeamSort!]) {
  teams(paging: $paging, filter: $filter, sorting: $sorting) {
    totalCount
    pageInfo {
      hasNextPage
      hasPreviousPage
    }
    nodes {
      id
      name
      cleaners(paging: { limit: 100 }) {
        nodes {
          id
        }
        pageInfo {
          hasNextPage
        }
      }
    }
  }
}
    `;

/**
 * __useTeamsQuery__
 *
 * To run a query within a React component, call `useTeamsQuery` and pass it any options that fit your needs.
 * When your component renders, `useTeamsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useTeamsQuery({
 *   variables: {
 *      paging: // value for 'paging'
 *      filter: // value for 'filter'
 *      sorting: // value for 'sorting'
 *   },
 * });
 */
export function useTeamsQuery(baseOptions?: Apollo.QueryHookOptions<TeamsQuery, TeamsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<TeamsQuery, TeamsQueryVariables>(TeamsDocument, options);
      }
export function useTeamsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<TeamsQuery, TeamsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<TeamsQuery, TeamsQueryVariables>(TeamsDocument, options);
        }
// @ts-ignore
export function useTeamsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<TeamsQuery, TeamsQueryVariables>): Apollo.UseSuspenseQueryResult<TeamsQuery, TeamsQueryVariables>;
export function useTeamsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<TeamsQuery, TeamsQueryVariables>): Apollo.UseSuspenseQueryResult<TeamsQuery | undefined, TeamsQueryVariables>;
export function useTeamsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<TeamsQuery, TeamsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<TeamsQuery, TeamsQueryVariables>(TeamsDocument, options);
        }
export type TeamsQueryHookResult = ReturnType<typeof useTeamsQuery>;
export type TeamsLazyQueryHookResult = ReturnType<typeof useTeamsLazyQuery>;
export type TeamsSuspenseQueryHookResult = ReturnType<typeof useTeamsSuspenseQuery>;
export type TeamsQueryResult = Apollo.QueryResult<TeamsQuery, TeamsQueryVariables>;
export const TeamDocument = gql`
    query Team($id: ID!) {
  team(id: $id) {
    id
    name
    cleaners(paging: { limit: 100 }) {
      nodes {
        id
        fullName
        phone
        email
      }
      pageInfo {
        hasNextPage
      }
    }
  }
}
    `;

/**
 * __useTeamQuery__
 *
 * To run a query within a React component, call `useTeamQuery` and pass it any options that fit your needs.
 * When your component renders, `useTeamQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useTeamQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useTeamQuery(baseOptions: Apollo.QueryHookOptions<TeamQuery, TeamQueryVariables> & ({ variables: TeamQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<TeamQuery, TeamQueryVariables>(TeamDocument, options);
      }
export function useTeamLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<TeamQuery, TeamQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<TeamQuery, TeamQueryVariables>(TeamDocument, options);
        }
// @ts-ignore
export function useTeamSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<TeamQuery, TeamQueryVariables>): Apollo.UseSuspenseQueryResult<TeamQuery, TeamQueryVariables>;
export function useTeamSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<TeamQuery, TeamQueryVariables>): Apollo.UseSuspenseQueryResult<TeamQuery | undefined, TeamQueryVariables>;
export function useTeamSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<TeamQuery, TeamQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<TeamQuery, TeamQueryVariables>(TeamDocument, options);
        }
export type TeamQueryHookResult = ReturnType<typeof useTeamQuery>;
export type TeamLazyQueryHookResult = ReturnType<typeof useTeamLazyQuery>;
export type TeamSuspenseQueryHookResult = ReturnType<typeof useTeamSuspenseQuery>;
export type TeamQueryResult = Apollo.QueryResult<TeamQuery, TeamQueryVariables>;
export const CreateTeamDocument = gql`
    mutation CreateTeam($input: CreateTeamInput!) {
  createTeam(input: $input) {
    id
  }
}
    `;
export type CreateTeamMutationFn = Apollo.MutationFunction<CreateTeamMutation, CreateTeamMutationVariables>;

/**
 * __useCreateTeamMutation__
 *
 * To run a mutation, you first call `useCreateTeamMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateTeamMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createTeamMutation, { data, loading, error }] = useCreateTeamMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateTeamMutation(baseOptions?: Apollo.MutationHookOptions<CreateTeamMutation, CreateTeamMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateTeamMutation, CreateTeamMutationVariables>(CreateTeamDocument, options);
      }
export type CreateTeamMutationHookResult = ReturnType<typeof useCreateTeamMutation>;
export type CreateTeamMutationResult = Apollo.MutationResult<CreateTeamMutation>;
export type CreateTeamMutationOptions = Apollo.BaseMutationOptions<CreateTeamMutation, CreateTeamMutationVariables>;