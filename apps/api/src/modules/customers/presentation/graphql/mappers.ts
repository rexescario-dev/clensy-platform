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
    createdAt: customer.createdAt,
    email: customer.email,
    fullName: customer.fullName,
    notes: customer.notes,
    phone: customer.phone,
    updatedAt: customer.updatedAt,
  };
}

export function toPropertyType(property: Property): PropertyType {
  return {
    id: property.id,
    customerId: property.customerId,
    accessNotes: property.accessNotes,
    addressLine1: property.addressLine1,
    addressLine2: property.addressLine2,
    city: property.city,
    createdAt: property.createdAt,
    label: property.label,
    postalCode: property.postalCode,
    region: property.region,
    updatedAt: property.updatedAt,
  };
}
