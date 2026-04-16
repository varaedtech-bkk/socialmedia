import type { Express } from "express";
import { storage } from "./storage";
import { publishPost } from "./publishPost";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

async function sendTelegramMessage(chatId: string | number, text: string): Promise<void> {
  const botToken = getRequiredEnv("TELEGRAM_BOT_TOKEN");
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Telegram sendMessage failed: ${response.status} ${details}`);
  }
}

function getHelpText(): string {
  return [
    "Telegram Agent Commands:",
    "/fb <text> - Publish a Facebook Page post immediately",
    "/help - Show this help",
  ].join("\n");
}

export function registerTelegramRoutes(app: Express): void {
  app.post("/api/integrations/telegram/webhook", async (req, res) => {
    const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (configuredSecret) {
      const incomingSecret = req.header("x-telegram-bot-api-secret-token");
      if (!incomingSecret || incomingSecret !== configuredSecret) {
        return res.status(401).json({ error: "Invalid Telegram webhook secret" });
      }
    }

    const update = req.body as any;
    const message = update?.message;
    const chatId = message?.chat?.id;
    const text = (message?.text || "").trim();

    if (!chatId || !text) {
      return res.sendStatus(200);
    }

    const allowedChatId = process.env.TELEGRAM_CHAT_ID;
    if (allowedChatId && String(chatId) !== String(allowedChatId)) {
      return res.sendStatus(200);
    }

    try {
      if (text === "/help" || text === "/start") {
        await sendTelegramMessage(chatId, getHelpText());
        return res.sendStatus(200);
      }

      if (!text.toLowerCase().startsWith("/fb ")) {
        await sendTelegramMessage(chatId, "Unsupported command.\n\n" + getHelpText());
        return res.sendStatus(200);
      }

      const content = text.slice(4).trim();
      if (!content) {
        await sendTelegramMessage(chatId, "Please provide post content. Example:\n/fb Launching our new feature today!");
        return res.sendStatus(200);
      }

      const userId = Number(process.env.TELEGRAM_DEFAULT_USER_ID || "0");
      if (!Number.isInteger(userId) || userId <= 0) {
        throw new Error("TELEGRAM_DEFAULT_USER_ID must be set to a valid app user id");
      }

      const user = await storage.getUser(userId);
      if (!user) throw new Error(`User ${userId} not found`);
      if (!user.facebookPageToken || !user.facebookPageId) {
        throw new Error("Default user has no connected Facebook Page");
      }

      const post = await storage.createPost(user.id, {
        content,
        scheduledTime: null,
        platforms: ["facebook-page"],
        mediaUrls: [],
        mediaType: "text",
        timezone: "UTC",
        status: "draft",
        analytics: {
          impressions: 0,
          clicks: 0,
          likes: 0,
          shares: 0,
          comments: 0,
        },
      });

      await publishPost(post.id);
      await sendTelegramMessage(chatId, `Posted to Facebook Page successfully.\nPost ID: ${post.id}`);
      return res.sendStatus(200);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Unknown Telegram agent error";
      console.error("[TELEGRAM_WEBHOOK_ERROR]", messageText);
      await sendTelegramMessage(chatId, `Failed to publish: ${messageText}`).catch(() => {});
      return res.sendStatus(200);
    }
  });
}
