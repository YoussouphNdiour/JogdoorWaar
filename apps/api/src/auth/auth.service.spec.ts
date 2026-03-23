import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Plan, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

// Fournir une clé AES-256 valide (64 hex chars) pour les tests
process.env.ENCRYPTION_KEY = 'a'.repeat(64);

const mockUser = {
  id: 'user-123',
  email: 'aminata@test.sn',
  firstName: 'Aminata',
  lastName: 'Diallo',
  passwordHash: '$2b$12$hashedpassword',
  phone: null,
  plan: Plan.FREE,
  role: UserRole.CANDIDATE,
  isActive: true,
  emailVerified: false,
  whatsappVerified: false,
  isAnonymousMode: false,
  avatarUrl: null,
  createdAt: new Date('2026-03-01'),
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
            },
            session: {
              create: jest.fn(),
              findFirst: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-access-token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const map: Record<string, string | number> = {
                JWT_ACCESS_SECRET: 'test-secret',
                JWT_ACCESS_EXPIRES_IN: '15m',
                JWT_REFRESH_SECRET: 'refresh-secret',
              };
              return map[key];
            }),
            getOrThrow: jest.fn((key: string) => {
              const map: Record<string, string | number> = {
                JWT_ACCESS_SECRET: 'test-secret',
                JWT_ACCESS_EXPIRES_IN: '15m',
                JWT_REFRESH_SECRET: 'refresh-secret',
              };
              return map[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jwtService = module.get(JwtService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── register() ───────────────────────────────────────────────────────────

  describe('register()', () => {
    const dto: RegisterDto = {
      email: 'aminata@test.sn',
      password: 'Password123!',
      firstName: 'Aminata',
      lastName: 'Diallo',
    };

    it('crée un utilisateur et retourne les tokens', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);
      (prisma.session.create as jest.Mock).mockResolvedValue({});

      const result = await service.register(dto);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'aminata@test.sn' }),
        }),
      );
      expect(result.accessToken).toBeDefined();
      expect(result.user.email).toBe('aminata@test.sn');
    });

    it('normalise l\'email en minuscules avant création', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({ ...mockUser, email: 'AMINATA@TEST.SN'.toLowerCase() });
      (prisma.session.create as jest.Mock).mockResolvedValue({});

      await service.register({ ...dto, email: 'AMINATA@TEST.SN' });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'aminata@test.sn' }),
        }),
      );
    });

    it('lève ConflictException si l\'email est déjà utilisé', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('hache le mot de passe avant de le stocker', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);
      (prisma.session.create as jest.Mock).mockResolvedValue({});

      await service.register(dto);

      const createCall = (prisma.user.create as jest.Mock).mock.calls[0][0];
      const storedHash: string = createCall.data.passwordHash;
      expect(storedHash).not.toBe(dto.password);
      const valid = await bcrypt.compare(dto.password, storedHash);
      expect(valid).toBe(true);
    });
  });

  // ─── login() ──────────────────────────────────────────────────────────────

  describe('login()', () => {
    const dto: LoginDto = { email: 'aminata@test.sn', password: 'Password123!' };

    it('retourne les tokens pour un login valide', async () => {
      const hash = await bcrypt.hash(dto.password, 10);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...mockUser, passwordHash: hash });
      (prisma.session.create as jest.Mock).mockResolvedValue({});

      const result = await service.login(dto);

      expect(result.accessToken).toBeDefined();
      expect(result.user.email).toBe('aminata@test.sn');
    });

    it('lève UnauthorizedException pour un mauvais mot de passe', async () => {
      const hash = await bcrypt.hash('correct-password', 10);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...mockUser, passwordHash: hash });

      await expect(service.login({ ...dto, password: 'wrong-password' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('lève UnauthorizedException si l\'utilisateur n\'existe pas', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('lève UnauthorizedException si le compte est désactivé', async () => {
      const hash = await bcrypt.hash(dto.password, 10);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        passwordHash: hash,
        isActive: false,
      });

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('lève UnauthorizedException si passwordHash est null (compte OAuth)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        passwordHash: null,
      });

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });
  });
});
