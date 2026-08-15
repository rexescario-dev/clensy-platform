/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import { gql } from '@apollo/client';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** A date-time string at UTC, such as 2019-12-03T09:54:33Z, compliant with the date-time format. */
  DateTime: { input: unknown; output: unknown; }
};

export type Admin = {
  __typename?: 'Admin';
  email: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  role: Role;
};

export type Booking = {
  __typename?: 'Booking';
  createdAt: Scalars['DateTime']['output'];
  customerName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  scheduledAt: Scalars['DateTime']['output'];
  serviceType: Scalars['String']['output'];
  status: BookingStatus;
};

export enum BookingStatus {
  Cancelled = 'CANCELLED',
  Completed = 'COMPLETED',
  Confirmed = 'CONFIRMED',
  Pending = 'PENDING'
}

export type CreateAdminInput = {
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
  role: Role;
};

export type CreateBookingInput = {
  customerName: Scalars['String']['input'];
  scheduledAt: Scalars['DateTime']['input'];
  serviceType: Scalars['String']['input'];
};

export type CurrentAdmin = {
  __typename?: 'CurrentAdmin';
  id: Scalars['ID']['output'];
  role: Role;
};

export type LoginInput = {
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
};

export type LoginResult = {
  __typename?: 'LoginResult';
  admin: CurrentAdmin;
  success: Scalars['Boolean']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  createAdmin: Admin;
  createBooking: Booking;
  disableAdmin: Admin;
  login: LoginResult;
  removeBooking: Booking;
  updateBooking: Booking;
};


export type MutationCreateAdminArgs = {
  createAdminInput: CreateAdminInput;
};


export type MutationCreateBookingArgs = {
  createBookingInput: CreateBookingInput;
};


export type MutationDisableAdminArgs = {
  id: Scalars['ID']['input'];
};


export type MutationLoginArgs = {
  loginInput: LoginInput;
};


export type MutationRemoveBookingArgs = {
  id: Scalars['ID']['input'];
};


export type MutationUpdateBookingArgs = {
  updateBookingInput: UpdateBookingInput;
};

export type Query = {
  __typename?: 'Query';
  admins: Array<Admin>;
  booking: Booking;
  bookings: Array<Booking>;
  currentAdmin: CurrentAdmin;
};


export type QueryBookingArgs = {
  id: Scalars['ID']['input'];
};

export enum Role {
  Analyst = 'ANALYST',
  CustomerSupport = 'CUSTOMER_SUPPORT',
  Finance = 'FINANCE',
  OpsManager = 'OPS_MANAGER',
  Owner = 'OWNER',
  Scheduler = 'SCHEDULER'
}

export type UpdateBookingInput = {
  customerName?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  scheduledAt?: InputMaybe<Scalars['DateTime']['input']>;
  serviceType?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<BookingStatus>;
};
