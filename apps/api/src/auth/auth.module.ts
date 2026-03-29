import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OptionalJwtGuard } from './guards/optional-jwt.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

// GoogleStrategy and GoogleGmailStrategy are registered only when GOOGLE_CLIENT_ID
// is configured, so local-only development doesn't crash on missing OAuth credentials.
const googleStrategyProviders = process.env.GOOGLE_CLIENT_ID
  ? [
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./strategies/google.strategy').GoogleStrategy,
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./strategies/google-gmail.strategy').GoogleGmailStrategy,
    ]
  : [];

// LinkedInStrategy is registered only when LINKEDIN_CLIENT_ID is configured,
// following the same optional-provider pattern as googleStrategyProviders.
const linkedInStrategyProviders = process.env.LINKEDIN_CLIENT_ID
  ? [
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./strategies/linkedin.strategy').LinkedInStrategy,
    ]
  : [];

@Module({
  imports: [
    ConfigModule, // already global, re-importing is a no-op but makes dependency explicit
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN') ?? '900s',
          issuer: 'jog-door-waar',
          audience: 'jog-door-waar-client',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    OptionalJwtGuard,
    ...googleStrategyProviders,
    ...linkedInStrategyProviders,
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    RolesGuard,
    OptionalJwtGuard,
    JwtModule,
    PassportModule,
  ],
})
export class AuthModule {}
