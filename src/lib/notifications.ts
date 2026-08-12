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
  | 'minor_seo_change'
  | 'website_added'
  | 'website_deleted';

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

const TYPE_META: Record<NotificationType, { emoji: string; color: string; label: string }> = {
  score_drop:          { emoji: '📉', color: '#ef4444', label: 'SEO Score Drop' },
  broken_links:        { emoji: '🔗', color: '#f97316', label: 'Broken Links Detected' },
  title_change:        { emoji: '✏️',  color: '#8b5cf6', label: 'Title Tag Changed' },
  meta_change:         { emoji: '🔍', color: '#8b5cf6', label: 'Meta Description Changed' },
  sitemap_unavailable: { emoji: '🗺️',  color: '#f59e0b', label: 'Sitemap Unavailable' },
  site_offline:        { emoji: '🚨', color: '#dc2626', label: 'Site Offline' },
  minor_seo_change:    { emoji: '⚡', color: '#6366f1', label: 'SEO Change Detected' },
  website_added:       { emoji: '✅', color: '#10b981', label: 'Website Added' },
  website_deleted:     { emoji: '🗑️',  color: '#6b7280', label: 'Website Removed' },
};

function buildEmailHtml(type: NotificationType, message: string): string {
  const meta = TYPE_META[type] || TYPE_META['minor_seo_change'];
  const dashboardUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/dashboard`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
          <div style="font-size:36px;margin-bottom:8px;">${meta.emoji}</div>
          <h1 style="color:white;margin:0;font-size:22px;font-weight:700;letter-spacing:-0.5px;">SEOPulse Alert</h1>
          <p style="color:rgba(255,255,255,0.75);margin:6px 0 0;font-size:14px;">${meta.label}</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#ffffff;padding:32px 40px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
          <div style="background:${meta.color}15;border-left:4px solid ${meta.color};border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px;">
            <p style="margin:0;color:#111827;font-size:16px;line-height:1.6;">${message}</p>
          </div>
          <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 24px;">
            Log in to your SEOPulse dashboard to view full details, run a new audit, or update your monitoring settings.
          </p>
          <div style="text-align:center;">
            <a href="${dashboardUrl}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;letter-spacing:0.3px;">
              Open Dashboard →
            </a>
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center;">
          <p style="color:#9ca3af;font-size:12px;margin:0;">
            You're receiving this because you're a member of a SEOPulse workspace.<br>
            <a href="${dashboardUrl}/settings/notifications" style="color:#6366f1;text-decoration:none;">Manage notification preferences</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
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
      const meta = TYPE_META[opts.type] || TYPE_META['minor_seo_change'];
      await resend.emails.send({
        from: 'SEOPulse <alerts@noreply.seopulse.app>',
        to: Array.from(emailsToSend),
        subject: `${meta.emoji} SEOPulse: ${meta.label}`,
        html: buildEmailHtml(opts.type, opts.message),
      });
    } catch (e) {
      console.warn('Resend email failed:', e);
    }
  }

  // 3. Slack webhook (if provided)
  if (opts.slackWebhookUrl) {
    try {
      const meta = TYPE_META[opts.type] || TYPE_META['minor_seo_change'];
      await fetch(opts.slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `${meta.emoji} *SEOPulse — ${meta.label}*: ${opts.message}`,
        }),
      });
    } catch (e) {
      console.warn('Slack webhook failed:', e);
    }
  }

  // 4. Discord webhook (if provided)
  if (opts.discordWebhookUrl) {
    try {
      const meta = TYPE_META[opts.type] || TYPE_META['minor_seo_change'];
      await fetch(opts.discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `${meta.emoji} **SEOPulse — ${meta.label}**: ${opts.message}`,
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
