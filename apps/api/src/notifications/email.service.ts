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

  async sendApplicationEmail(params: {
    to: string;
    candidateName: string;
    candidateEmail: string;
    jobTitle: string;
    company: string;
    cvUrl?: string;
    cvFileName?: string;
    coverLetter?: string;
  }): Promise<void> {
    const { to, candidateName, candidateEmail, jobTitle, company, cvUrl, cvFileName, coverLetter } = params;

    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        reply_to: candidateEmail,
        subject: `Candidature : ${jobTitle} — ${candidateName}`,
        html: this.buildApplicationEmailHtml(candidateName, candidateEmail, jobTitle, company, coverLetter),
        attachments: cvUrl ? [{ filename: cvFileName ?? 'cv.pdf', path: cvUrl }] : [],
      });
      this.logger.log(`Email candidature envoyé → ${to} (${jobTitle})`);
    } catch (err) {
      this.logger.error(`Erreur email candidature → ${to}: ${err}`);
      throw err;
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

  private buildApplicationEmailHtml(
    candidateName: string,
    candidateEmail: string,
    jobTitle: string,
    company: string,
    coverLetter?: string,
  ): string {
    const coverLetterBlock = coverLetter
      ? `<div style="margin-top:24px;padding:20px;background:#FDFAF6;border-left:4px solid #E8580A;border-radius:0 8px 8px 0">
           <h3 style="margin:0 0 12px;color:#1B4332;font-size:15px">Lettre de motivation</h3>
           <div style="font-size:14px;line-height:1.7;color:#374151;white-space:pre-wrap">${coverLetter.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
         </div>`
      : '';

    return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"></head>
<body style="font-family:'DM Sans',Arial,sans-serif;background:#FDFAF6;margin:0;padding:20px">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;border:1px solid #E5E7EB">
    <div style="background:#1B4332;color:white;padding:24px 32px">
      <p style="margin:0;font-size:12px;opacity:.7;letter-spacing:1px;text-transform:uppercase">Via Jog Door Waar</p>
      <h1 style="margin:8px 0 0;font-size:20px;font-weight:700">Nouvelle candidature</h1>
    </div>
    <div style="padding:32px">
      <div style="background:#FFF7F3;border:1px solid #FED7C0;border-radius:12px;padding:16px 20px;margin-bottom:24px">
        <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#1B4332">Poste visé</p>
        <p style="margin:0;font-size:18px;font-weight:700;color:#E8580A">${jobTitle}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#6B7280">${company}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr>
          <td style="padding:8px 0;color:#6B7280;width:140px">Candidat</td>
          <td style="padding:8px 0;font-weight:600;color:#111827">${candidateName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6B7280">Email</td>
          <td style="padding:8px 0"><a href="mailto:${candidateEmail}" style="color:#E8580A">${candidateEmail}</a></td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6B7280">CV</td>
          <td style="padding:8px 0;color:#059669">${(coverLetter || '') ? '✓ Joint en pièce jointe' : '✓ Joint en pièce jointe'}</td>
        </tr>
      </table>
      ${coverLetterBlock}
      <p style="margin-top:32px;font-size:13px;color:#6B7280">
        Vous pouvez répondre directement à cet email pour contacter le candidat.<br>
        Candidature reçue via <a href="${this.config.get('APP_URL', 'https://jogdoorwaar.sn')}" style="color:#E8580A">Jog Door Waar</a>.
      </p>
    </div>
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
