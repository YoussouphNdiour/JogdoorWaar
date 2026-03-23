import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

/**
 * OptionalJwtGuard behaves like JwtAuthGuard but never rejects unauthenticated requests.
 * If a valid Bearer token is present, req.user is populated normally.
 * If the token is absent or invalid, the request continues with req.user = undefined.
 *
 * Useful for public routes that enrich the response when a user is logged in
 * (e.g., GET /jobs/:id — shows matchScore only for authenticated users).
 */
@Injectable()
export class OptionalJwtGuard extends AuthGuard('jwt') {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  // Override handleRequest so missing/invalid tokens are silently swallowed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleRequest<TUser = any>(
    _err: Error | null,
    user: TUser | false,
    _info: unknown,
  ): TUser {
    // Return the user if present, otherwise return undefined without throwing
    return (user || undefined) as TUser;
  }
}
