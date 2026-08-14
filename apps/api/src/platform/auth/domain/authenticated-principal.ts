import { Role } from './role';

export interface AuthenticatedPrincipal {
  id: string;
  role: Role;
}
