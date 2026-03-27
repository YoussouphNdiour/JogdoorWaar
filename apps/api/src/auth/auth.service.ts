import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Plan, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Profile } from 'passport-google-oauth20';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

// ─── AES-256-GCM helpers ──────────────────────────────────────────────────────

const ENCRYPTION_KEY_HEX = process.env.ENCRYPTION_KEY ?? '';
const IV_LENGTH = 12; // 96-bit IV for GCM
const TAG_LENGTH = 16;

/**
 * Encrypts a plaintext string with AES-256-GCM.
 * Returns a colon-delimited hex string: iv:authTag:ciphertext
 */
function encryptField(plaintext: string): string {
  if (!ENCRYPTION_KEY_HEX || ENCRYPTION_KEY_HEX.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY env var must be a 64-char hex string (32 bytes)',
    );
  }
  const key = Buffer.from(ENCRYPTION_KEY_HEX, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a value produced by encryptField().
 */
function decryptField(ciphertext: string): string {
  if (!ENCRYPTION_KEY_HEX || ENCRYPTION_KEY_HEX.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY env var must be a 64-char hex string (32 bytes)',
    );
  }
  const [ivHex, tagHex, dataHex] = ciphertext.split(':');
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error('Ciphertext format invalide');
  }
  const key = Buffer.from(ENCRYPTION_KEY_HEX, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag.slice(0, TAG_LENGTH));
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    'utf8',
  );
}

// Exported so tests and other modules can use the same helpers
export { encryptField, decryptField };

// ─── Token config ─────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_BYTES = 64;
const REFRESH_TOKEN_TTL_DAYS = 30;

// ─── Service ──────────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

export interface AuthResponse {
  user: SafeUser;
  accessToken: string;
  expiresIn: number;
}

/**
 * Subset of User returned to callers — never includes passwordHash or raw tokens.
 */
export interface SafeUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string; // decrypted, only present when ENCRYPTION_KEY is set
  avatarUrl: string | null;
  role: UserRole;
  plan: Plan;
  emailVerified: boolean;
  whatsappNumber?: string;
  whatsappVerified: boolean;
  isAnonymousMode: boolean;
  createdAt: Date;
  title?: string; // from UserProfile.currentJobTitle
  city?: string;  // from UserProfile.city
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Register ─────────────────────────────────────────────────────────────

  async register(
    dto: RegisterDto,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Un compte avec cet email existe déjà');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // Encrypt sensitive fields before persisting
    const encryptedPhone = dto.phone ? encryptField(dto.phone) : null;

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        passwordHash,
        phone: encryptedPhone,
        role: (dto.role as unknown as import('@prisma/client').UserRole) ?? 'CANDIDATE',
        profile: {
          create: {
            city: 'Dakar',
            country: 'Sénégal',
          },
        },
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role, user.plan);
    await this.persistRefreshToken(user.id, tokens.refreshToken, userAgent, ipAddress);

    this.logger.log(`Nouvel utilisateur enregistré: ${user.id}`);

    return {
      user: this.toSafeUser(user),
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
    };
  }

  // ─── Login ────────────────────────────────────────────────────────────────

  async login(
    dto: LoginDto,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<AuthTokens & { user: SafeUser }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Ce compte a été désactivé');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role, user.plan);
    await this.persistRefreshToken(user.id, tokens.refreshToken, userAgent, ipAddress);

    this.logger.log(`Connexion réussie: ${user.id}`);

    return {
      user: this.toSafeUser(user),
      ...tokens,
    };
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);

    await this.prisma.session.deleteMany({
      where: { refreshToken: tokenHash },
    });
  }

  // ─── Refresh tokens ───────────────────────────────────────────────────────

  async refreshTokens(
    refreshToken: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<AuthTokens & { user: SafeUser }> {
    const tokenHash = this.hashToken(refreshToken);

    const session = await this.prisma.session.findUnique({
      where: { refreshToken: tokenHash },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException('Session invalide ou expirée');
    }

    if (session.expiresAt < new Date()) {
      // Clean up expired session
      await this.prisma.session.delete({ where: { id: session.id } });
      throw new UnauthorizedException('Session expirée — veuillez vous reconnecter');
    }

    if (!session.user.isActive) {
      throw new UnauthorizedException('Ce compte a été désactivé');
    }

    // Token rotation: delete old session, issue new tokens
    await this.prisma.session.delete({ where: { id: session.id } });

    const tokens = await this.generateTokens(
      session.user.id,
      session.user.email,
      session.user.role,
      session.user.plan,
    );
    await this.persistRefreshToken(
      session.user.id,
      tokens.refreshToken,
      userAgent,
      ipAddress,
    );

    return {
      user: this.toSafeUser(session.user),
      ...tokens,
    };
  }

  // ─── Google OAuth ─────────────────────────────────────────────────────────

  async validateGoogleUser(
    profile: Profile,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<AuthTokens & { user: SafeUser }> {
    const email = profile.emails?.[0]?.value?.toLowerCase();
    if (!email) {
      throw new BadRequestException('Email non disponible dans le profil Google');
    }

    const providerId = profile.id;
    const firstName = profile.name?.givenName ?? 'Utilisateur';
    const lastName = profile.name?.familyName ?? '';
    const avatarUrl = profile.photos?.[0]?.value ?? null;

    // Check if an OAuthAccount already links this Google identity
    const existingOAuth = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerId: { provider: 'google', providerId } },
      include: { user: true },
    });

    if (existingOAuth) {
      const tokens = await this.generateTokens(
        existingOAuth.user.id,
        existingOAuth.user.email,
        existingOAuth.user.role,
        existingOAuth.user.plan,
      );
      await this.persistRefreshToken(
        existingOAuth.user.id,
        tokens.refreshToken,
        userAgent,
        ipAddress,
      );
      return { user: this.toSafeUser(existingOAuth.user), ...tokens };
    }

    // Find or create user by email
    let user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          firstName,
          lastName,
          avatarUrl,
          emailVerified: true, // Google guarantees email ownership
          oauthAccounts: {
            create: { provider: 'google', providerId },
          },
          profile: {
            create: { city: 'Dakar', country: 'Sénégal' },
          },
        },
      });
    } else {
      // Link Google account to existing user
      await this.prisma.oAuthAccount.create({
        data: { userId: user.id, provider: 'google', providerId },
      });
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role, user.plan);
    await this.persistRefreshToken(user.id, tokens.refreshToken, userAgent, ipAddress);

    this.logger.log(`Connexion Google réussie: ${user.id}`);

    return { user: this.toSafeUser(user), ...tokens };
  }

  // ─── Password reset ───────────────────────────────────────────────────────

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always respond with success to prevent user enumeration
    if (!user) {
      this.logger.warn(`Tentative forgot-password pour email inconnu: ${email}`);
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = this.hashToken(resetToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 heure

    // Store the hashed token as a special "reset" session entry
    // We reuse the Session table with a sentinel userId pattern;
    // a dedicated PasswordReset table would be cleaner for a v2.
    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: `RESET:${resetTokenHash}`,
        expiresAt,
        userAgent: 'password-reset',
      },
    });

    // In development, log the token to the console instead of sending an email
    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(
        `[DEV] Token de réinitialisation pour ${email}: ${resetToken}`,
      );
    }

    // TODO (Sprint 4): envoyer l'email via Resend
    // await this.notificationsService.sendPasswordResetEmail(user.email, resetToken);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashToken(token);

    const session = await this.prisma.session.findFirst({
      where: {
        refreshToken: `RESET:${tokenHash}`,
        expiresAt: { gt: new Date() },
      },
    });

    if (!session) {
      throw new BadRequestException('Token de réinitialisation invalide ou expiré');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: session.userId },
        data: { passwordHash },
      }),
      // Invalidate the reset token + all active sessions (security measure)
      this.prisma.session.deleteMany({
        where: { userId: session.userId },
      }),
    ]);

    this.logger.log(`Mot de passe réinitialisé pour l'utilisateur: ${session.userId}`);
  }

  // ─── Email verification ───────────────────────────────────────────────────

  async verifyEmail(userId: string, otp: string): Promise<void> {
    // Retrieve the pending OTP stored as a session with sentinel pattern
    const tokenHash = this.hashToken(otp);

    const session = await this.prisma.session.findFirst({
      where: {
        userId,
        refreshToken: `OTP:${tokenHash}`,
        expiresAt: { gt: new Date() },
      },
    });

    if (!session) {
      throw new BadRequestException('Code OTP invalide ou expiré');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { emailVerified: true },
      }),
      this.prisma.session.delete({ where: { id: session.id } }),
    ]);

    this.logger.log(`Email vérifié pour l'utilisateur: ${userId}`);
  }

  // ─── Get current user ─────────────────────────────────────────────────────

  async findById(userId: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    return this.toSafeUser(user, user.profile ?? null);
  }

  // ─── Update profile ───────────────────────────────────────────────────────

  async updateMe(userId: string, dto: UpdateProfileDto): Promise<SafeUser> {
    let encryptedPhone: string | undefined;
    if (dto.phone) {
      try {
        encryptedPhone = encryptField(dto.phone);
      } catch (err) {
        this.logger.warn('ENCRYPTION_KEY not configured — phone field skipped', err);
        // Skip phone update rather than crashing the whole request
      }
    }

    const profileFields = {
      ...(dto.title !== undefined && { currentJobTitle: dto.title }),
      ...(dto.city !== undefined && { city: dto.city }),
      ...(dto.headline !== undefined && { headline: dto.headline }),
      ...(dto.summary !== undefined && { summary: dto.summary }),
      ...(dto.yearsOfExperience !== undefined && { yearsOfExperience: dto.yearsOfExperience }),
      ...(dto.isOpenToWork !== undefined && { isOpenToWork: dto.isOpenToWork }),
      ...(dto.preferredWorkMode !== undefined && { preferredWorkMode: dto.preferredWorkMode }),
      ...(dto.preferredJobTypes !== undefined && { preferredJobTypes: dto.preferredJobTypes }),
    };
    const hasProfileUpdate = Object.keys(profileFields).length > 0;
    const profileUpsert = hasProfileUpdate
      ? {
          upsert: {
            create: profileFields,
            update: profileFields,
          },
        }
      : undefined;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName.trim() }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName.trim() }),
        ...(encryptedPhone !== undefined && { phone: encryptedPhone }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
        ...(dto.whatsappNumber !== undefined && {
          whatsappNumber: dto.whatsappNumber.trim(),
          whatsappVerified: true,
        }),
        ...(profileUpsert !== undefined && { profile: profileUpsert }),
      },
      include: { profile: true },
    });

    return this.toSafeUser(user, user.profile ?? null);
  }

  // ─── Token generation ─────────────────────────────────────────────────────

  async generateTokens(
    userId: string,
    email: string,
    role: UserRole,
    plan: Plan,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: userId,
      email,
      role,
      plan,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');

    const accessExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN') ?? '900';
    const expiresIn =
      typeof accessExpiresIn === 'string' && accessExpiresIn.endsWith('s')
        ? parseInt(accessExpiresIn, 10)
        : parseInt(accessExpiresIn, 10);

    return { accessToken, refreshToken, expiresIn: isNaN(expiresIn) ? 900 : expiresIn };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async persistRefreshToken(
    userId: string,
    refreshToken: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(
      Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    await this.prisma.session.create({
      data: {
        userId,
        refreshToken: tokenHash,
        userAgent: userAgent ?? null,
        ipAddress: ipAddress ?? null,
        expiresAt,
      },
    });
  }

  /**
   * SHA-256 one-way hash used to store refresh tokens and OTPs safely.
   * The raw token is never persisted.
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private toSafeUser(
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      phone: string | null;
      avatarUrl: string | null;
      role: UserRole;
      plan: Plan;
      emailVerified: boolean;
      whatsappNumber: string | null;
      whatsappVerified: boolean;
      isAnonymousMode: boolean;
      createdAt: Date;
    },
    profile?: { currentJobTitle?: string | null; city?: string | null } | null,
  ): SafeUser {
    let phone: string | undefined;
    if (user.phone) {
      try {
        phone = decryptField(user.phone);
      } catch {
        // ENCRYPTION_KEY not configured — return phone as undefined
      }
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone,
      avatarUrl: user.avatarUrl,
      role: user.role,
      plan: user.plan,
      emailVerified: user.emailVerified,
      whatsappNumber: user.whatsappNumber ?? undefined,
      whatsappVerified: user.whatsappVerified,
      isAnonymousMode: user.isAnonymousMode,
      createdAt: user.createdAt,
      title: profile?.currentJobTitle ?? undefined,
      city: profile?.city ?? undefined,
    };
  }
}
