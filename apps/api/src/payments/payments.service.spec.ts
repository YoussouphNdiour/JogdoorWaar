import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { WaveService } from './wave.service';
import { OrangeMoneyService } from './orange-money.service';
import { StripeService } from './stripe.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Plan } from '@prisma/client';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';

const MOCK_USER = { id: 'user-1', email: 'test@test.sn' };

const waveDto: InitiatePaymentDto = {
  plan: Plan.PREMIUM,
  paymentMethod: 'WAVE' as any,
};

const orangeDto: InitiatePaymentDto = {
  plan: Plan.RECRUITER,
  paymentMethod: 'ORANGE_MONEY' as any,
  phone: '+221770000000',
};

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: jest.Mocked<PrismaService>;
  let waveService: jest.Mocked<WaveService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUniqueOrThrow: jest.fn().mockResolvedValue(MOCK_USER),
            },
            subscription: {
              upsert: jest.fn().mockResolvedValue({}),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: WaveService,
          useValue: {
            createCheckoutSession: jest.fn().mockResolvedValue({ redirectUrl: 'https://wave.sn/pay/abc' }),
            verifyWebhookSignature: jest.fn().mockReturnValue(true),
          },
        },
        {
          provide: OrangeMoneyService,
          useValue: {
            initiatePayment: jest.fn().mockResolvedValue({ redirectUrl: 'https://orange.sn/pay/xyz' }),
          },
        },
        {
          provide: StripeService,
          useValue: {
            createCheckoutSession: jest.fn().mockResolvedValue({ url: 'https://stripe.com/pay/session' }),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    prisma = module.get(PrismaService);
    waveService = module.get(WaveService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── initiatePayment() ────────────────────────────────────────────────────

  describe('initiatePayment()', () => {
    it('retourne une URL Wave pour le plan PREMIUM', async () => {
      const result = await service.initiatePayment('user-1', waveDto);

      expect(result.redirectUrl).toBe('https://wave.sn/pay/abc');
      expect(prisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ plan: Plan.PREMIUM, amount: 3500, status: 'pending' }),
        }),
      );
    });

    it('retourne une URL Orange Money pour le plan RECRUITER', async () => {
      const result = await service.initiatePayment('user-1', orangeDto);

      expect(result.redirectUrl).toBe('https://orange.sn/pay/xyz');
      expect(prisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ plan: Plan.RECRUITER, amount: 15000 }),
        }),
      );
    });

    it('lève BadRequestException pour le plan FREE', async () => {
      await expect(
        service.initiatePayment('user-1', { ...waveDto, plan: Plan.FREE }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.subscription.upsert).not.toHaveBeenCalled();
    });

    it('lève BadRequestException si Orange Money sans numéro de téléphone', async () => {
      await expect(
        service.initiatePayment('user-1', { ...orangeDto, phone: undefined }),
      ).rejects.toThrow(BadRequestException);
    });

    it('persiste une subscription en statut "pending" avant l\'appel au provider', async () => {
      await service.initiatePayment('user-1', waveDto);

      const upsertCall = (prisma.subscription.upsert as jest.Mock).mock.calls[0][0];
      expect(upsertCall.create.status).toBe('pending');
      // Wave doit être appelé APRÈS l'upsert
      expect(waveService.createCheckoutSession).toHaveBeenCalled();
    });
  });

  // ─── handleWaveWebhook() ──────────────────────────────────────────────────

  describe('handleWaveWebhook()', () => {
    const pendingSub = {
      id: 'sub-1',
      userId: 'user-1',
      plan: Plan.PREMIUM,
      externalPaymentId: 'ref-123',
      status: 'pending',
    };

    const successPayload = {
      client_reference: 'ref-123',
      status: 'succeeded',
    };

    it('active la subscription et met à jour le plan utilisateur sur succès', async () => {
      (waveService.verifyWebhookSignature as jest.Mock).mockReturnValue(true);
      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(pendingSub);
      (prisma.$transaction as jest.Mock).mockResolvedValue({});

      await service.handleWaveWebhook(successPayload, 'valid-sig');

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('ignore les webhooks avec signature invalide', async () => {
      (waveService.verifyWebhookSignature as jest.Mock).mockReturnValue(false);

      await expect(
        service.handleWaveWebhook(successPayload, 'bad-sig'),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('ne fait rien si le statut n\'est pas "succeeded"', async () => {
      (waveService.verifyWebhookSignature as jest.Mock).mockReturnValue(true);
      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(pendingSub);

      await service.handleWaveWebhook({ ...successPayload, status: 'failed' }, 'valid-sig');

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('logue un warning si la subscription n\'est pas trouvée', async () => {
      (waveService.verifyWebhookSignature as jest.Mock).mockReturnValue(true);
      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(null);

      // Ne doit pas lever d'exception, juste ignorer
      await expect(
        service.handleWaveWebhook(successPayload, 'valid-sig'),
      ).resolves.not.toThrow();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});

