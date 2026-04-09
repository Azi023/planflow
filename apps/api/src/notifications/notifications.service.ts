import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private resend: Resend | null = null;
  private from: string;
  private appUrl: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (apiKey && !apiKey.includes('placeholder')) {
      this.resend = new Resend(apiKey);
    }
    this.from = this.config.get<string>(
      'EMAIL_FROM',
      'PlanFlow <noreply@planflow.csedash.xyz>',
    );
    this.appUrl = this.config.get<string>(
      'APP_URL',
      'https://planflow.csedash.xyz',
    );
  }

  /** Fire-and-forget email send — never throws */
  private send(payload: EmailPayload): void {
    if (!this.resend) {
      this.logger.debug(`Email skipped (no API key): ${payload.subject}`);
      return;
    }
    this.resend.emails
      .send({ from: this.from, ...payload })
      .then(() => this.logger.log(`Email sent to ${payload.to}: ${payload.subject}`))
      .catch((err) => this.logger.warn(`Email failed to ${payload.to}: ${err}`));
  }

  private wrap(title: string, body: string): string {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F6F6F9;font-family:Inter,-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F6F6F9;padding:40px 0">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #E1E3EA;overflow:hidden">
<tr><td style="background:#1C2135;padding:20px 32px">
<span style="color:#fff;font-size:16px;font-weight:600">Plan</span><span style="color:#1B84FF;font-size:16px;font-weight:600">Flow</span>
</td></tr>
<tr><td style="padding:32px">
<h2 style="margin:0 0 16px;font-size:18px;color:#071437">${title}</h2>
${body}
</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #F1F1F4;color:#99A1B7;font-size:12px">
Jasmin Media &middot; DC Group &middot; PlanFlow
</td></tr>
</table>
</td></tr></table></body></html>`;
  }

  private btn(text: string, url: string): string {
    return `<a href="${url}" style="display:inline-block;background:#1B84FF;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;margin:16px 0">${text}</a>`;
  }

  /** Template 1 — Plan shared with client */
  sendPlanShared(opts: {
    clientEmail: string;
    clientName: string;
    campaignName: string;
    preparedBy: string;
    budget: string;
    shareUrl: string;
    expiresAt?: string;
  }): void {
    const expiry = opts.expiresAt
      ? `<p style="color:#99A1B7;font-size:13px;margin-top:16px">This link expires on ${opts.expiresAt}.</p>`
      : '';
    this.send({
      to: opts.clientEmail,
      subject: `${opts.clientName} — Your Media Plan is Ready for Review`,
      html: this.wrap(
        'Your Media Plan is Ready',
        `<p style="color:#4B5675;font-size:14px;line-height:1.6">
A new media plan has been prepared for your review.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0">
<tr><td style="padding:8px 0;color:#99A1B7;font-size:13px;width:120px">Campaign</td>
<td style="padding:8px 0;color:#071437;font-size:14px;font-weight:500">${opts.campaignName}</td></tr>
<tr><td style="padding:8px 0;color:#99A1B7;font-size:13px">Prepared by</td>
<td style="padding:8px 0;color:#071437;font-size:14px">${opts.preparedBy}</td></tr>
<tr><td style="padding:8px 0;color:#99A1B7;font-size:13px">Budget</td>
<td style="padding:8px 0;color:#071437;font-size:14px;font-weight:500">${opts.budget}</td></tr>
</table>
${this.btn('View Plan', opts.shareUrl)}
${expiry}`,
      ),
    });
  }

  /** Template 2 — Plan approved by client */
  sendPlanApproved(opts: {
    creatorEmail: string;
    campaignName: string;
    approvedBy: string;
  }): void {
    this.send({
      to: opts.creatorEmail,
      subject: `✓ Plan Approved — ${opts.campaignName}`,
      html: this.wrap(
        'Plan Approved',
        `<p style="color:#4B5675;font-size:14px;line-height:1.6">
Great news! <strong>${opts.approvedBy}</strong> has approved the media plan
<strong>${opts.campaignName}</strong>.</p>
<p style="color:#4B5675;font-size:14px">You can now mark it as sent and begin campaign execution.</p>
${this.btn('Open Plan', `${this.appUrl}/media-plans`)}`,
      ),
    });
  }

  /** Template 3 — Revision requested */
  sendRevisionRequested(opts: {
    creatorEmail: string;
    campaignName: string;
    requestedBy: string;
    reason?: string;
  }): void {
    const reasonBlock = opts.reason
      ? `<div style="background:#FFF8DD;border:1px solid rgba(246,192,0,0.2);border-radius:8px;padding:12px 16px;margin:16px 0;font-size:13px;color:#4B5675">"${opts.reason}"</div>`
      : '';
    this.send({
      to: opts.creatorEmail,
      subject: `↩ Revision Requested — ${opts.campaignName}`,
      html: this.wrap(
        'Revision Requested',
        `<p style="color:#4B5675;font-size:14px;line-height:1.6">
<strong>${opts.requestedBy}</strong> has requested revisions to
<strong>${opts.campaignName}</strong>.</p>
${reasonBlock}
${this.btn('Edit Plan', `${this.appUrl}/media-plans`)}`,
      ),
    });
  }

  /** Template 4 — Status changed */
  sendStatusChanged(opts: {
    recipientEmail: string;
    campaignName: string;
    oldStatus: string;
    newStatus: string;
    changedBy: string;
  }): void {
    const statusLabel: Record<string, string> = {
      draft: 'Draft',
      pending_review: 'Pending Review',
      approved: 'Approved',
      sent: 'Sent',
    };
    this.send({
      to: opts.recipientEmail,
      subject: `Plan Status Update — ${opts.campaignName}`,
      html: this.wrap(
        'Plan Status Updated',
        `<p style="color:#4B5675;font-size:14px;line-height:1.6">
The status of <strong>${opts.campaignName}</strong> has been updated.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0">
<tr><td style="padding:8px 0;color:#99A1B7;font-size:13px;width:120px">Previous</td>
<td style="padding:8px 0;color:#4B5675;font-size:14px">${statusLabel[opts.oldStatus] ?? opts.oldStatus}</td></tr>
<tr><td style="padding:8px 0;color:#99A1B7;font-size:13px">Current</td>
<td style="padding:8px 0;color:#071437;font-size:14px;font-weight:600">${statusLabel[opts.newStatus] ?? opts.newStatus}</td></tr>
<tr><td style="padding:8px 0;color:#99A1B7;font-size:13px">Changed by</td>
<td style="padding:8px 0;color:#4B5675;font-size:14px">${opts.changedBy}</td></tr>
</table>
${this.btn('View Plan', `${this.appUrl}/media-plans`)}`,
      ),
    });
  }
}
