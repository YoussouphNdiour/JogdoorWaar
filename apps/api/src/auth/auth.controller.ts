import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService, SafeUser } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtPayload } from './interfaces/jwt-payload.interface';

// Refresh token cookie config
const REFRESH_COOKIE = 'refreshToken';
const REFRESH_COOKIE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Register ─────────────────────────────────────────────────────────────

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Créer un compte candidat" })
  @ApiResponse({ status: 201, description: 'Compte créé — accessToken retourné' })
  @ApiResponse({ status: 409, description: 'Email déjà utilisé' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: SafeUser; accessToken: string; expiresIn: number }> {
    const result = await this.authService.register(
      dto,
      req.headers['user-agent'],
      req.ip,
    );

    // refreshToken not returned from register — user can call /auth/login
    return {
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    };
  }

  // ─── Login ────────────────────────────────────────────────────────────────

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  // Rate limit: 5 requests per hour per IP (login brute-force protection)
  @Throttle({ login: { limit: 5, ttl: 3600000 } })
  @ApiOperation({ summary: 'Connexion avec email/mot de passe' })
  @ApiResponse({ status: 200, description: 'Connexion réussie — cookie refreshToken défini' })
  @ApiResponse({ status: 401, description: 'Identifiants incorrects' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: SafeUser; accessToken: string; expiresIn: number }> {
    const result = await this.authService.login(
      dto,
      req.headers['user-agent'],
      req.ip,
    );

    this.setRefreshCookie(res, result.refreshToken);

    return {
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    };
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Déconnexion — invalide la session et supprime le cookie' })
  @ApiResponse({ status: 204, description: 'Déconnexion réussie' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    this.clearRefreshCookie(res);
  }

  // ─── Refresh ──────────────────────────────────────────────────────────────

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOperation({ summary: 'Renouveler le accessToken via le cookie refreshToken' })
  @ApiResponse({ status: 200, description: 'Nouveau accessToken émis' })
  @ApiResponse({ status: 401, description: 'Session invalide ou expirée' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: SafeUser; accessToken: string; expiresIn: number }> {
    const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;

    if (!refreshToken) {
      // Avoid leaking implementation detail — use 401
      throw Object.assign(new Error('Token manquant'), { status: 401 });
    }

    const result = await this.authService.refreshTokens(
      refreshToken,
      req.headers['user-agent'],
      req.ip,
    );

    // Rotate the cookie with the new refresh token
    this.setRefreshCookie(res, result.refreshToken);

    return {
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    };
  }

  // ─── Forgot password ──────────────────────────────────────────────────────

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Demander un lien de réinitialisation du mot de passe' })
  @ApiResponse({
    status: 202,
    description: 'Email envoyé si le compte existe (anti-enumeration)',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    await this.authService.forgotPassword(dto.email);
    return {
      message:
        'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.',
    };
  }

  // ─── Reset password ───────────────────────────────────────────────────────

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Réinitialiser le mot de passe avec le token reçu par email' })
  @ApiResponse({ status: 200, description: 'Mot de passe mis à jour' })
  @ApiResponse({ status: 400, description: 'Token invalide ou expiré' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Mot de passe réinitialisé avec succès.' };
  }

  // ─── Email verification ───────────────────────────────────────────────────

  @Post('verify-email')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Vérifier l'email avec le code OTP reçu" })
  @ApiResponse({ status: 200, description: 'Email vérifié' })
  @ApiResponse({ status: 400, description: 'OTP invalide ou expiré' })
  async verifyEmail(
    @CurrentUser() user: JwtPayload,
    @Body() dto: VerifyEmailDto,
  ): Promise<{ message: string }> {
    await this.authService.verifyEmail(user.sub, dto.otp);
    return { message: 'Email vérifié avec succès.' };
  }

  // ─── Current user ─────────────────────────────────────────────────────────

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Retourne le profil de l'utilisateur connecté" })
  @ApiResponse({ status: 200, description: 'Profil utilisateur' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async me(@CurrentUser() user: JwtPayload): Promise<SafeUser> {
    return this.authService.findById(user.sub);
  }

  // ─── Google OAuth ─────────────────────────────────────────────────────────

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initier le flux OAuth Google — redirige vers Google' })
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  googleAuth(): void {
    // Passport redirects automatically; this handler body is intentionally empty
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Callback OAuth Google — émet les tokens et redirige' })
  async googleCallback(
    @Req() req: Request & { user: { user: SafeUser; accessToken: string; refreshToken: string; expiresIn: number } },
    @Res() res: Response,
  ): Promise<void> {
    const { user, accessToken, refreshToken } = req.user;

    this.setRefreshCookie(res as unknown as Response, refreshToken);

    const frontendUrl =
      process.env.FRONTEND_URL ?? 'http://localhost:3000';

    // Redirect to frontend with accessToken in query param (short-lived, picked up by the client)
    res.redirect(
      `${frontendUrl}/auth/callback?token=${encodeURIComponent(accessToken)}&userId=${encodeURIComponent(user.id)}`,
    );
  }

  // ─── Cookie helpers ───────────────────────────────────────────────────────

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: REFRESH_COOKIE_TTL_MS,
      path: '/auth', // restrict cookie to /auth/* routes only
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/auth',
    });
  }
}
