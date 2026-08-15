import { Role } from '../../../../platform/auth/domain/role';

export interface CreateAdminCommand {
  actorId: string;
  email: string;
  password: string;
  role: Role;
}
