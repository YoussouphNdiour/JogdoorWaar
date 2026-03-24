import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import * as Sentry from '@sentry/node';
import { AppModule } from './app.module';
import { SentryExceptionFilter } from './common/filters/sentry-exception.filter';

// ── Initialiser Sentry AVANT la création de l'app NestJS ──────────────────────
// Sentry doit être initialisé le plus tôt possible pour intercepter toutes
// les erreurs, y compris celles survenant au démarrage du module.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // 10 % des transactions en production (éviter les coûts excessifs)
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    environment: process.env.NODE_ENV ?? 'development',

    // Intégrations de traçage HTTP et base de données
    integrations: [
      // Trace les requêtes HTTP sortantes (scraping, appels Anthropic, etc.)
      Sentry.httpIntegration(),
    ],

    // Ne jamais capturer de données sensibles dans les breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      // Supprimer les headers d'autorisation des traces HTTP
      if (breadcrumb.category?.startsWith('http')) {
        if (breadcrumb.data?.['request_headers']) {
          delete breadcrumb.data['request_headers']['Authorization'];
          delete breadcrumb.data['request_headers']['authorization'];
          delete breadcrumb.data['request_headers']['cookie'];
        }
      }
      return breadcrumb;
    },

    // Filtrer les événements avant envoi
    beforeSend(event, hint) {
      const err = hint?.originalException;
      if (err instanceof Error) {
        // Ne jamais envoyer d'erreurs contenant des données sensibles dans le message
        if (err.message?.match(/password|secret|bearer|token/i)) {
          event.message = '[REDACTED — message contenant des données sensibles]';
          event.exception = undefined;
          return event;
        }
      }
      return event;
    },
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.use(cookieParser());

  // Filtre global : capture les exceptions non gérées vers Sentry
  // et renvoie une réponse JSON structurée.
  app.useGlobalFilters(new SentryExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Jog Door Waar API')
    .setDescription("Agrégateur IA d'offres d'emploi — marché sénégalais")
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
