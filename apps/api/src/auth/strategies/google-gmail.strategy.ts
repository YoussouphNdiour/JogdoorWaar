import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';

/**
 * Separate Google strategy that requests the gmail.send scope.
 * Used exclusively for the /auth/gmail/connect route — not for login.
 * Forces the consent screen so Google always returns a refresh_token.
 */
@Injectable()
export class GoogleGmailStrategy extends PassportStrategy(Strategy, 'google-gmail') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.getOrThrow<string>('GOOGLE_GMAIL_CALLBACK_URL'),
      scope: ['email', 'profile', 'https://www.googleapis.com/auth/gmail.send'],
      accessType: 'offline',
      prompt: 'consent', // Forces Google to return refresh_token every time
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    // Pass tokens + profile to the controller via req.user
    done(null, { profile, googleAccessToken: accessToken, googleRefreshToken: refreshToken });
  }
}
