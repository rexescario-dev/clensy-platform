import { SetMetadata } from '@nestjs/common';
import { Role } from '../domain/role';

export const ROLES_KEY = 'roles';

// `@Roles(RoleA, RoleB, ...)` — OR semantics across the listed roles (spec
// §4.2): `AuthGuard` allows the request through when the current
// principal's role matches ANY entry in this list. Absence of this
// decorator on an operation guarded only by `AuthGuard` means
// "authenticated only, any role" — there is no separate "no roles required"
// marker to reason about.
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
