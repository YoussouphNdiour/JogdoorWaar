import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { Job, Alert, User } from '@prisma/client';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.resend = new Resend(config.get('RESEND_API_KEY'));
    this.from = config.get('NOTIFICATION_FROM_EMAIL', 'alertes@jogdoorwaar.sn');
  }

  async sendJobAlert(user: User, jobs: Job[], alert: Alert): Promise<void> {
    const jobsList = jobs
      .slice(0, 5)
      .map(
        (j) =>
          `<li><strong>${j.title}</strong> — ${j.company} (${j.city ?? 'Sénégal'})<br>
           <a href="${j.sourceUrl}">Voir l'offre →</a></li>`,
      )
      .join('');

    try {
      await this.resend.emails.send({
        from: this.from,
        to: user.email,
        subject: `🔔 ${jobs.length} nouvelle${jobs.length > 1 ? 's' : ''} offre${jobs.length > 1 ? 's' : ''} — ${alert.name}`,
        html: this.buildAlertEmailHtml(user.firstName, alert.name, jobs.length, jobsList),
      });
    } catch (err) {
      this.logger.error(`Erreur email alerte → ${user.email}: ${err}`);
    }
  }

  async sendWelcomeEmail(user: User): Promise<void> {
    try {
      await this.resend.emails.send({
        from: this.from,
        to: user.email,
        subject: 'Bienvenue sur Jog Door Waar 🎉',
        html: this.buildWelcomeEmailHtml(user.firstName),
      });
    } catch (err) {
      this.logger.error(`Erreur email bienvenue → ${user.email}: ${err}`);
    }
  }

  async sendPasswordResetEmail(email: string, resetToken: string, firstName: string): Promise<void> {
    const appUrl = this.config.get('APP_URL', 'http://localhost:3000');
    const resetUrl = `${appUrl}/auth/reset-password?token=${resetToken}`;

    try {
      await this.resend.emails.send({
        from: this.from,
        to: email,
        subject: 'Réinitialisation de votre mot de passe — Jog Door Waar',
        html: this.buildPasswordResetHtml(firstName, resetUrl),
      });
    } catch (err) {
      this.logger.error(`Erreur email reset password → ${email}: ${err}`);
    }
  }

  async sendEmailVerificationOtp(email: string, otp: string, firstName: string): Promise<void> {
    try {
      await this.resend.emails.send({
        from: this.from,
        to: email,
        subject: `Votre code de vérification Jog Door Waar : ${otp}`,
        html: this.buildOtpEmailHtml(firstName, otp),
      });
    } catch (err) {
      this.logger.error(`Erreur email OTP → ${email}: ${err}`);
    }
  }

  // ─── Templates HTML ───────────────────────────────────────────

  private buildAlertEmailHtml(
    firstName: string,
    alertName: string,
    count: number,
    jobsList: string,
  ): string {
    return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><style>
  body { font-family: 'DM Sans', Arial, sans-serif; background: #FDFAF6; margin: 0; padding: 20px; }
  .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; }
  .header { background: #1B4332; color: white; padding: 24px 32px; }
  .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
  .body { padding: 32px; }
  .tag { background: #E8580A; color: white; padding: 4px 12px; border-radius: 20px; font-size: 13px; display: inline-block; margin-bottom: 16px; }
  ul { padding-left: 20px; line-height: 1.8; }
  a { color: #E8580A; }
  .footer { background: #F5EFE6; padding: 16px 32px; font-size: 12px; color: #6B7280; text-align: center; }
</style></head>
<body>
  <div class="container">
    <div class="header"><h1>🔔 Jog Door Waar</h1></div>
    <div class="body">
      <div class="tag">${count} nouvelle${count > 1 ? 's' : ''} offre${count > 1 ? 's' : ''}</div>
      <h2 style="color:#1B4332;margin-top:0">Bonjour ${firstName} 👋</h2>
      <p>Votre alerte <strong>"${alertName}"</strong> a trouvé de nouvelles offres pour vous :</p>
      <ul>${jobsList}</ul>
      <p style="margin-top:24px">
        <a href="${this.config.get('APP_URL', 'http://localhost:3000')}/jobs"
           style="background:#E8580A;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
          Voir toutes les offres →
        </a>
      </p>
    </div>
    <div class="footer">
      Vous recevez cet email car vous avez une alerte active sur Jog Door Waar.<br>
      <a href="${this.config.get('APP_URL', 'http://localhost:3000')}/alerts">Gérer mes alertes</a>
    </div>
  </div>
</body>
</html>`;
  }

  private buildWelcomeEmailHtml(firstName: string): string {
    return `
<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#FDFAF6;padding:20px">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden">
    <div style="background:#1B4332;color:white;padding:24px 32px">
      <h1 style="margin:0;font-size:20px">Bienvenue sur Jog Door Waar 🎉</h1>
    </div>
    <div style="padding:32px">
      <h2 style="color:#1B4332">Bonjour ${firstName} !</h2>
      <p>Votre compte est créé. <strong>Aujourd'hui il y a du travail !</strong></p>
      <p>Commencez par :</p>
      <ol>
        <li>📄 Uploader votre CV</li>
        <li>🔔 Créer vos premières alertes emploi</li>
        <li>🤖 Découvrir vos offres recommandées par l'IA</li>
      </ol>
    </div>
  </div>
</body>
</html>`;
  }

  private buildPasswordResetHtml(firstName: string, resetUrl: string): string {
    return `
<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#FDFAF6;padding:20px">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;padding:32px">
    <h2 style="color:#1B4332">Réinitialisation de mot de passe</h2>
    <p>Bonjour ${firstName},</p>
    <p>Cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe (valable 1 heure) :</p>
    <p>
      <a href="${resetUrl}" style="background:#E8580A;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
        Réinitialiser mon mot de passe
      </a>
    </p>
    <p style="font-size:12px;color:#6B7280">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
  </div>
</body>
</html>`;
  }

  private buildOtpEmailHtml(firstName: string, otp: string): string {
    return `
<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#FDFAF6;padding:20px">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;padding:32px;text-align:center">
    <h2 style="color:#1B4332">Vérification de votre email</h2>
    <p>Bonjour ${firstName},</p>
    <p>Votre code de vérification :</p>
    <div style="font-size:40px;font-weight:700;letter-spacing:12px;color:#E8580A;padding:24px;background:#FDF0E9;border-radius:12px;margin:16px 0">
      ${otp}
    </div>
    <p style="font-size:12px;color:#6B7280">Ce code expire dans 10 minutes.</p>
  </div>
</body>
</html>`;
  }
}
