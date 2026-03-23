import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { Request, Response } from 'express';

/**
 * Filtre global qui :
 * 1. Capture toutes les exceptions non gérées vers Sentry (si SENTRY_DSN est défini).
 * 2. Ne logue JAMAIS de données sensibles (tokens, mots de passe, clés API).
 * 3. Renvoie une réponse JSON structurée au client.
 *
 * Enregistrer dans main.ts avec : app.useGlobalFilters(new SentryExceptionFilter());
 */
@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SentryExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // ── Déterminer le statut HTTP ─────────────────────────────────────────────
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // ── Ne capturer que les erreurs 5xx dans Sentry ──────────────────────────
    // Les erreurs 4xx (validation, auth) sont attendues et ne doivent pas
    // remplir le quota Sentry ni créer du bruit.
    const shouldCapture = status >= HttpStatus.INTERNAL_SERVER_ERROR;

    if (shouldCapture) {
      Sentry.withScope((scope) => {
        // Ajouter des informations contextuelles utiles (sans données sensibles)
        scope.setTag('http.method', request.method);
        scope.setTag('http.status_code', status);

        // Ajouter l'URL sans les query params (peuvent contenir des tokens)
        scope.setExtra('url', request.url.split('?')[0]);

        // Ajouter le user id s'il est disponible (JAMAIS l'email ou le téléphone)
        const user = request.user as { id?: string; role?: string } | undefined;
        if (user?.id) {
          scope.setUser({ id: user.id, role: user.role });
        }

        Sentry.captureException(exception);
      });
    }

    // ── Logger côté serveur ───────────────────────────────────────────────────
    if (shouldCapture) {
      // Erreur 5xx : logger en error avec la stack
      this.logger.error(
        `${request.method} ${request.url.split('?')[0]} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      // Erreur 4xx : logger en warn sans stack pour garder les logs lisibles
      this.logger.warn(
        `${request.method} ${request.url.split('?')[0]} → ${status}`,
      );
    }

    // ── Construire la réponse JSON ────────────────────────────────────────────
    const errorBody =
      exception instanceof HttpException ? exception.getResponse() : null;

    const message =
      typeof errorBody === 'string'
        ? errorBody
        : typeof errorBody === 'object' && errorBody !== null && 'message' in errorBody
          ? (errorBody as { message: string | string[] }).message
          : 'Erreur interne du serveur';

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      // Ne pas inclure le path complet pour éviter de fuiter des paramètres sensibles
      path: request.url.split('?')[0],
    });
  }
}
