/** Platform GraphQL collection paging policy (Accepted spec §4.1). */
export const PLATFORM_PAGE_DEFAULT = 20;
export const PLATFORM_PAGE_MAX = 100;

/**
 * Intended default sorts (unique `id` tie-breaker). Per-surface 9.5.0 option
 * bags are adapters — do not assume one object is valid on every decorator.
 *
 * - bookings / jobs / property.bookings: scheduledAt DESC, id ASC
 * - checklist.items: position ASC, id ASC
 * - all other §4.2 collections: createdAt DESC, id ASC
 */
