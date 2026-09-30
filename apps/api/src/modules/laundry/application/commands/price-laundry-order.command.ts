export interface LaundryOrderAddOnInput {
  addOnId: string;
  // Honoured only when the resolved rule's unit is PER_ITEM (spec §4.5
  // step 3a). Integer >= 1; defaults to 1.
  quantity?: number;
}

export interface PriceLaundryOrderCommand {
  actorId: string;
  orderId: string;
  baseServiceId: string;
  // Honoured only when the base service's resolved rule is PER_ITEM.
  baseQuantity?: number;
  addOns: LaundryOrderAddOnInput[];
  // The principal's tenant (`requireTenantId`, #84 spec §4.5/§4.4; #87
  // slice decision 8). Scopes the order lock and the catalog pricing
  // lookups; the new lines take the locked order row's tenant.
  tenantId: string;
}
