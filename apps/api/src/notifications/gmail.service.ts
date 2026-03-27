import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';

export interface GmailSendParams {
  googleAccessToken: string;
  googleRefreshToken: string;
  to: string;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  company: string;
  cvUrl?: string;
  cvFileName?: string;
  coverLetter?: string;
}

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Send an application email via the user's Gmail account.
   * Returns the Gmail message ID on success, throws on failure.
   */
  async sendApplicationEmail(params: GmailSendParams): Promise<string> {
    const {
      googleAccessToken,
      googleRefreshToken,
      to,
      candidateName,
      candidateEmail,
      jobTitle,
      company,
      cvUrl,
      cvFileName,
      coverLetter,
    } = params;

    const oauth2Client = new google.auth.OAuth2(
      this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
    );

    oauth2Client.setCredentials({
      access_token: googleAccessToken,
      refresh_token: googleRefreshToken,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Fetch CV attachment if URL provided
    let attachmentBuffer: Buffer | null = null;
    if (cvUrl) {
      try {
        const res = await fetch(cvUrl);
        if (res.ok) {
          attachmentBuffer = Buffer.from(await res.arrayBuffer());
        }
      } catch (err) {
        this.logger.warn(`Could not fetch CV for Gmail attachment: ${err}`);
      }
    }

    const raw = attachmentBuffer
      ? this.buildMimeWithAttachment({
          to,
          from: candidateEmail,
          subject: `Candidature : ${jobTitle} — ${candidateName}`,
          html: this.buildHtml(candidateName, candidateEmail, jobTitle, company, coverLetter),
          filename: cvFileName ?? 'cv.pdf',
          attachment: attachmentBuffer,
        })
      : this.buildMimeSimple({
          to,
          from: candidateEmail,
          subject: `Candidature : ${jobTitle} — ${candidateName}`,
          html: this.buildHtml(candidateName, candidateEmail, jobTitle, company, coverLetter),
        });

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    const messageId = result.data.id ?? 'sent-via-gmail';
    this.logger.log(`Gmail candidature envoyée → ${to} (${jobTitle}) id=${messageId}`);
    return messageId;
  }

  // ─── MIME builders ────────────────────────────────────────────────────────

  private buildMimeSimple(opts: {
    to: string;
    from: string;
    subject: string;
    html: string;
  }): string {
    const boundary = `boundary_${Date.now()}`;
    const lines = [
      `From: ${opts.from}`,
      `To: ${opts.to}`,
      `Subject: =?UTF-8?B?${Buffer.from(opts.subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(opts.html, 'utf8').toString('base64'),
      '',
      `--${boundary}--`,
    ];
    return Buffer.from(lines.join('\r\n')).toString('base64url');
  }

  private buildMimeWithAttachment(opts: {
    to: string;
    from: string;
    subject: string;
    html: string;
    filename: string;
    attachment: Buffer;
  }): string {
    const outer = `outer_${Date.now()}`;
    const inner = `inner_${Date.now() + 1}`;
    const lines = [
      `From: ${opts.from}`,
      `To: ${opts.to}`,
      `Subject: =?UTF-8?B?${Buffer.from(opts.subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${outer}"`,
      '',
      `--${outer}`,
      `Content-Type: multipart/alternative; boundary="${inner}"`,
      '',
      `--${inner}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(opts.html, 'utf8').toString('base64'),
      '',
      `--${inner}--`,
      '',
      `--${outer}`,
      `Content-Type: application/pdf; name="${opts.filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${opts.filename}"`,
      '',
      opts.attachment.toString('base64'),
      '',
      `--${outer}--`,
    ];
    return Buffer.from(lines.join('\r\n')).toString('base64url');
  }

  // ─── HTML template ────────────────────────────────────────────────────────

  private buildHtml(
    candidateName: string,
    candidateEmail: string,
    jobTitle: string,
    company: string,
    coverLetter?: string,
  ): string {
    const appUrl = this.config.get('APP_URL', 'https://jogdoorwaar.sn');
    const coverLetterBlock = coverLetter
      ? `<div style="margin-top:24px;padding:20px;background:#FDFAF6;border-left:4px solid #E8580A;border-radius:0 8px 8px 0">
           <h3 style="margin:0 0 12px;color:#1B4332;font-size:15px">Lettre de motivation</h3>
           <div style="font-size:14px;line-height:1.7;color:#374151;white-space:pre-wrap">${coverLetter.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
         </div>`
      : '';

    return `<!DOCTYPE html>
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
          <td style="padding:8px 0;color:#059669">✓ Joint en pièce jointe</td>
        </tr>
      </table>
      ${coverLetterBlock}
      <p style="margin-top:32px;font-size:13px;color:#6B7280">
        Vous pouvez répondre directement à cet email pour contacter le candidat.<br>
        Candidature reçue via <a href="${appUrl}" style="color:#E8580A">Jog Door Waar</a>.
      </p>
    </div>
  </div>
</body>
</html>`;
  }
}
