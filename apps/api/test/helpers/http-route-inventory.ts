// Controller-route inventory shared by #91's route guard
// (`http-route-authorization.e2e-spec.ts`) and #92's release gate (one
// inventory source). Keys are `routeKey(method, path)` from
// `http-surface.ts`.
export type RouteClass = 'PUBLIC_DEV_ONLY' | 'TENANT_VIEW' | 'TENANT_WRITE';

export const HTTP_ROUTE_CLASSIFICATION: Readonly<Record<string, RouteClass>> = {
  'DELETE /bookings/:id': 'TENANT_WRITE',
  'GET /bookings': 'TENANT_VIEW',
  'GET /bookings/:id': 'TENANT_VIEW',
  'GET /graphiql': 'PUBLIC_DEV_ONLY',
  'PATCH /bookings/:id': 'TENANT_WRITE',
  'POST /bookings': 'TENANT_WRITE',
};

export function tenantHttpRouteKeys(): string[] {
  return Object.entries(HTTP_ROUTE_CLASSIFICATION)
    .filter(([, routeClass]) => routeClass !== 'PUBLIC_DEV_ONLY')
    .map(([key]) => key)
    .sort();
}
