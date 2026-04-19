import { getSuperAdminNotifyEmail } from "./notification-config";
import { isSmtpConfigured, sendSmtpMail } from "./smtp-send";

/**
 * Notify platform super admin: prefers SMTP from .env when set, else Resend, else console.
 *
 * Env SMTP: SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS, SMTP_SECURE (optional),
 *   SMTP_FROM (or SMTP_USER as From)
 * Env Resend (optional): RESEND_API_KEY, NOTIFICATION_FROM_EMAIL
 * Recipient: app_settings `notification_super_admin_email` (admin UI) else SUPER_ADMIN_EMAIL
 */
export async function notifySuperAdmin(subject: string, textBody: string): Promise<void> {
  const to = await getSuperAdminNotifyEmail();

  console.log(`[NOTIFY_SUPER_ADMIN] ${subject}\n${textBody}`);

  if (!to) {
    console.warn("[NOTIFY_SUPER_ADMIN] No recipient: set email in Admin → Settings or SUPER_ADMIN_EMAIL");
    return;
  }

  if (isSmtpConfigured()) {
    try {
      await sendSmtpMail({ to, subject, text: textBody });
      console.log("[NOTIFY_SUPER_ADMIN] Sent via SMTP");
      return;
    } catch (e) {
      console.error("[NOTIFY_SUPER_ADMIN] SMTP failed", e);
    }
  }

  const resendKey = process.env.RESEND_API_KEY?.trim();
  const resendFrom = process.env.NOTIFICATION_FROM_EMAIL?.trim();
  if (resendFrom && resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [to],
          subject,
          text: textBody,
        }),
      });
      if (!res.ok) {
        const err = await res.text().catch(() => "");
        console.error("[NOTIFY_SUPER_ADMIN] Resend error", res.status, err);
      } else {
        console.log("[NOTIFY_SUPER_ADMIN] Sent via Resend");
      }
    } catch (e) {
      console.error("[NOTIFY_SUPER_ADMIN] Resend send failed", e);
    }
  }
}
