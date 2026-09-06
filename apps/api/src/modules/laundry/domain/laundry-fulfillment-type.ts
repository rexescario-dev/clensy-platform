// How the finished laundry is returned to the customer (spec §3, §4.2).
// Chosen at intake, immutable. Selects which branch is legal out of
// `READY`: `PICKUP` -> `AWAITING_PICKUP`, `DELIVERY` -> `AWAITING_DELIVERY`.
// This is the customer's stated return preference only — delivery logistics
// (routes, legs, addresses) are #42.
export enum LaundryFulfillmentType {
  PICKUP = 'PICKUP',
  DELIVERY = 'DELIVERY',
}
