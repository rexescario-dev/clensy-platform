import { Customer } from '../../domain/customer';
import { Property } from '../../domain/property';
import { CustomerType } from './customer.type';
import { PropertyType } from './property.type';

// Never expose `Customer`/`Property` (the domain interfaces) or their
// TypeORM entities as GraphQL values — every service result is mapped
// through one of these before leaving a resolver. Nested `properties` /
// `bookings` are Relatable-owned and are not populated here.
export function toCustomerType(customer: Customer): CustomerType {
  return {
    id: customer.id,
    fullName: customer.fullName,
    email: customer.email,
    phone: customer.phone,
    notes: customer.notes,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  } as CustomerType;
}

export function toPropertyType(property: Property): PropertyType {
  return {
    id: property.id,
    customerId: property.customerId,
    label: property.label,
    addressLine1: property.addressLine1,
    addressLine2: property.addressLine2,
    city: property.city,
    region: property.region,
    postalCode: property.postalCode,
    accessNotes: property.accessNotes,
    createdAt: property.createdAt,
    updatedAt: property.updatedAt,
  };
}
