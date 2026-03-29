import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-linkedin-oauth2';

/**
 * LinkedInStrategy handles the OAuth 2.0 flow with LinkedIn.
 * Only registered when LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET are set.
 *
 * Note: LinkedIn's standard OAuth 2.0 (r_emailaddress + r_liteprofile) does not
 * support offline_access, so no refresh token is expected or stored.
 * The validate() method passes the raw profile + accessToken to the controller
 * via req.user, letting the controller call AuthService.validateLinkedInUser().
 */
@Injectable()
export class LinkedInStrategy extends PassportStrategy(Strategy, 'linkedin') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.getOrThrow<string>('LINKEDIN_CLIENT_ID'),
      clientSecret: configService.getOrThrow<string>('LINKEDIN_CLIENT_SECRET'),
      callbackURL: configService.getOrThrow<string>('LINKEDIN_CALLBACK_URL'),
      scope: ['r_emailaddress', 'r_liteprofile'],
      state: false, // No session middleware — disable CSRF state
    });
  }

  /**
   * Called by Passport after LinkedIn redirects back with a code.
   * Returns { profile, accessToken } — no refresh token for LinkedIn standard OAuth.
   */
  validate(
    accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: (error: Error | null, user?: { profile: Profile; accessToken: string }) => void,
  ): void {
    done(null, { profile, accessToken });
  }
}
