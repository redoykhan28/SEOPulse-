import { prisma } from './prisma';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export type NotificationType =
  | 'broken_links'
  | 'score_drop'
  | 'title_change'
  | 'meta_change'
  | 'sitemap_unavailable'
  | 'site_offline'
  | 'minor_seo_change';

interface NotifyOptions {
  userId?: string;
  organizationId?: string;
  type: NotificationType;
  message: string;
  userEmail?: string;
  additionalEmails?: string[];
  slackWebhookUrl?: string;
  discordWebhookUrl?: string;
}

// ─── Create an in-app notification ──────────────────────────────────────────
export async function createNotification(opts: NotifyOptions) {
  // 1. In-app (always)
  await prisma.notification.create({
    data: {
      userId: opts.userId,
      organizationId: opts.organizationId,
      type: opts.type,
      message: opts.message,
    },
  });

  // 2. Email via Resend (if configured)
  const emailsToSend = new Set<string>();
  if (opts.userEmail) emailsToSend.add(opts.userEmail);
  if (opts.additionalEmails) {
    opts.additionalEmails.forEach(e => emailsToSend.add(e));
  }

  if (resend && emailsToSend.size > 0) {
    try {
      await resend.emails.send({
        from: 'SEOPulse <alerts@noreply.seopulse.app>',
        to: Array.from(emailsToSend),
        subject: `🚨 SEOPulse Alert: ${opts.type.replace(/_/g, ' ').toUpperCase()}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
            <div style="background:#4f46e5;padding:16px 24px;border-radius:12px 12px 0 0">
              <h1 style="color:white;margin:0;font-size:20px">⚡ SEOPulse Alert</h1>
            </div>
            <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
              <p style="font-size:16px;color:#111827;margin:0 0 16px">${opts.message}</p>
              <p style="font-size:13px;color:#6b7280;margin:0">
                Log in to your <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard" style="color:#4f46e5">SEOPulse dashboard</a> to view details.
              </p>
            </div>
          </div>
        `,
      });
    } catch (e) {
      console.warn('Resend email failed:', e);
    }
  }

  // 3. Slack webhook (if provided)
  if (opts.slackWebhookUrl) {
    try {
      await fetch(opts.slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `⚡ *SEOPulse Alert*: ${opts.message}`,
        }),
      });
    } catch (e) {
      console.warn('Slack webhook failed:', e);
    }
  }

  // 4. Discord webhook (if provided)
  if (opts.discordWebhookUrl) {
    try {
      await fetch(opts.discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `⚡ **SEOPulse Alert**: ${opts.message}`,
        }),
      });
    } catch (e) {
      console.warn('Discord webhook failed:', e);
    }
  }
}

// ─── Check if user has a certain alert type enabled ──────────────────────────
export async function isAlertEnabled(userId: string, alertType: NotificationType): Promise<boolean> {
  const pref = await prisma.notificationPreference.findUnique({
    where: { userId_alertType: { userId, alertType } },
  });
  // Default to enabled if no preference set
  return pref ? pref.enabled : true;
}
