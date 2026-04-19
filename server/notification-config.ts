/**
 * Super admin notification email: stored in app_settings (editable in admin),
 * with fallback to SUPER_ADMIN_EMAIL in environment.
 */
import { eq } from "drizzle-orm";
import { db, schema } from "./db";

export const NOTIFICATION_SUPER_ADMIN_SETTING_KEY = "notification_super_admin_email";

type StoredShape = { email?: string };

function parseStoredEmail(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && value !== null && "email" in value) {
    const e = (value as StoredShape).email;
    return typeof e === "string" ? e.trim() : "";
  }
  return "";
}

/** Resolved recipient for platform alerts (access requests, etc.). */
export async function getSuperAdminNotifyEmailSource(): Promise<{
  storedEmail: string;
  effectiveEmail: string | null;
}> {
  let storedEmail = "";
  try {
    const rows = await db
      .select()
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, NOTIFICATION_SUPER_ADMIN_SETTING_KEY))
      .limit(1);
    if (rows[0]) storedEmail = parseStoredEmail(rows[0].value);
  } catch {
    /* DB unavailable */
  }
  const env = process.env.SUPER_ADMIN_EMAIL?.trim() || null;
  const effectiveEmail = storedEmail || env;
  return { storedEmail, effectiveEmail };
}

export async function getSuperAdminNotifyEmail(): Promise<string | null> {
  const { effectiveEmail } = await getSuperAdminNotifyEmailSource();
  return effectiveEmail;
}

export async function setSuperAdminNotifyEmail(email: string, updatedBy: number): Promise<void> {
  const normalized = email.trim();
  const value = { email: normalized };
  const existing = await db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, NOTIFICATION_SUPER_ADMIN_SETTING_KEY))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(schema.appSettings)
      .set({
        value,
        updatedBy,
        updatedAt: new Date(),
      })
      .where(eq(schema.appSettings.key, NOTIFICATION_SUPER_ADMIN_SETTING_KEY));
  } else {
    await db.insert(schema.appSettings).values({
      key: NOTIFICATION_SUPER_ADMIN_SETTING_KEY,
      value,
      description: "Inbox for access requests and critical platform notifications",
      updatedBy,
    });
  }
}

export async function initializeNotificationSettings(): Promise<void> {
  try {
    const existing = await db
      .select()
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, NOTIFICATION_SUPER_ADMIN_SETTING_KEY))
      .limit(1);
    if (existing.length > 0) return;

    const seed = process.env.SUPER_ADMIN_EMAIL?.trim() || "";
    await db.insert(schema.appSettings).values({
      key: NOTIFICATION_SUPER_ADMIN_SETTING_KEY,
      value: { email: seed },
      description: "Inbox for access requests and critical platform notifications",
    });
    console.log("✅ Notification settings row initialized");
  } catch (e) {
    console.warn("⚠️  Could not initialize notification settings:", e);
  }
}
