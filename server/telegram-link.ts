import crypto from "crypto";

const TTL_MS = 15 * 60 * 1000;

function getSecret(): string {
  const s = process.env.TELEGRAM_LINK_SECRET || process.env.SESSION_SECRET;
  if (!s) throw new Error("Set TELEGRAM_LINK_SECRET or SESSION_SECRET for Telegram web linking");
  return s;
}

/** One-time token: Telegram user opens web login, then we attach chat id to logged-in user. */
export function createTelegramBindToken(telegramChatId: string): string {
  const exp = Date.now() + TTL_MS;
  const payload = `${telegramChatId}|${exp}`;
  const sig = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}|${sig}`, "utf8").toString("base64url");
}

export function verifyTelegramBindToken(token: string): { telegramChatId: string } | null {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const parts = raw.split("|");
    if (parts.length !== 3) return null;
    const [telegramChatId, expStr, sig] = parts;
    const exp = Number(expStr);
    if (!telegramChatId || !Number.isFinite(exp) || Date.now() > exp) return null;
    const payload = `${telegramChatId}|${exp}`;
    const expected = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    return { telegramChatId };
  } catch {
    return null;
  }
}

/** One-time token: WhatsApp user opens web login, then we attach wa id to logged-in user. */
export function createWhatsAppBindToken(whatsAppUserId: string): string {
  const exp = Date.now() + TTL_MS;
  const payload = `${whatsAppUserId}|${exp}`;
  const sig = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}|${sig}`, "utf8").toString("base64url");
}

export function verifyWhatsAppBindToken(token: string): { whatsAppUserId: string } | null {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const parts = raw.split("|");
    if (parts.length !== 3) return null;
    const [whatsAppUserId, expStr, sig] = parts;
    const exp = Number(expStr);
    if (!whatsAppUserId || !Number.isFinite(exp) || Date.now() > exp) return null;
    const payload = `${whatsAppUserId}|${exp}`;
    const expected = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    return { whatsAppUserId };
  } catch {
    return null;
  }
}
