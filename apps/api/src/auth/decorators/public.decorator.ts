import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * @Public() marks a route as publicly accessible — JwtAuthGuard will skip token verification.
 * Use on routes that must be reachable without a Bearer token (e.g., login, register).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
