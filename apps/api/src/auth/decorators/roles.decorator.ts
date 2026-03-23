import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@jdw/shared-types';

export const ROLES_KEY = 'roles';

/**
 * @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
 * Used together with RolesGuard to restrict route access by user role.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
