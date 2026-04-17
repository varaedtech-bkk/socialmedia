import type { Express } from "express";
import { storage } from "./storage";
import { publishPost } from "./publishPost";
import { createTelegramBindToken } from "./telegram-link";
import type { User } from "@shared/schema";

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
    "/connect - Get a link to link this chat to your dashboard login",
    "/accounts - List connected Facebook pages (social accounts)",
    "/defaultfb <id> - Set default Facebook page by social account id",
    "/fb <text> - Publish to default Facebook Page",
    "/fbdraft <text> - Save a Facebook draft without publishing",
    "/status - Show link + Facebook status",
    "/myposts [count] - Latest posts (default 5)",
    "/deletepost <id> - Delete your post (ownership checked)",
    "/ai <prompt> - AI draft (OpenRouter)",
    "/help - This help",
  ].join("\n");
}

async function resolveTelegramUser(chatId: number | string): Promise<User> {
  const linked = await storage.getUserByTelegramChatId(String(chatId));
  if (linked) return linked;
  const fallbackId = Number(process.env.TELEGRAM_DEFAULT_USER_ID || "0");
  if (!Number.isInteger(fallbackId) || fallbackId <= 0) {
    throw new Error(
      "This Telegram chat is not linked. Send /connect and open the link while logged into the web app."
    );
  }
  const u = await storage.getUser(fallbackId);
  if (!u) throw new Error(`TELEGRAM_DEFAULT_USER_ID=${fallbackId} user not found`);
  return u;
}

function publicBaseUrl(): string {
  return (process.env.CLIENT_URL || process.env.BASE_URL || "").replace(/\/$/, "");
}

async function createFacebookTextPost(user: User, content: string, publishNow: boolean) {
  const creds = await storage.getEffectiveFacebookPageCredentials(user.id);
  if (!creds) {
    throw new Error("No Facebook Page connected. Connect in the web app (Facebook Page) first.");
  }

  const post = await storage.createPost(user.id, {
    content,
    scheduledTime: null,
    platforms: ["facebook-page"],
    mediaUrls: [],
    mediaType: "text",
    timezone: "UTC",
    status: "draft",
    analytics: { impressions: 0, clicks: 0, likes: 0, shares: 0, comments: 0 },
  });

  if (publishNow) {
    await publishPost(post.id);
  }
  return { post };
}

async function generateWithAi(prompt: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");
  const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You write concise Facebook post drafts. Return plain text only." },
        { role: "user", content: `Write a facebook post about: ${prompt}` },
      ],
      temperature: 0.7,
    }),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result?.error?.message || "AI generation failed");
  }
  const content = result?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("AI returned empty content");
  return content;
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

      if (text === "/connect") {
        const base = publicBaseUrl();
        if (!base) throw new Error("CLIENT_URL or BASE_URL must be set for /connect links");
        const token = createTelegramBindToken(String(chatId));
        const url = `${base}/auth?telegram_bind=${encodeURIComponent(token)}`;
        await sendTelegramMessage(
          chatId,
          `Open this link in your browser, log in (or register), and your Telegram will be linked to that account:\n\n${url}\n\nThen use /fb to post.`
        );
        return res.sendStatus(200);
      }

      if (text === "/accounts") {
        const user = await resolveTelegramUser(chatId);
        const accounts = await storage.listSocialAccounts(user.id);
        const fb = accounts.filter((a) => a.platform === "facebook-page");
        if (!fb.length) {
          await sendTelegramMessage(
            chatId,
            "No Facebook Page accounts stored yet. Connect Facebook Page in the web dashboard."
          );
          return res.sendStatus(200);
        }
        const lines = fb.map(
          (a) => `#${a.id} ${a.isDefault ? "(default) " : ""}${a.displayName || "Page"} — ${a.externalId}`
        );
        await sendTelegramMessage(chatId, `Facebook pages:\n${lines.join("\n")}\n\nUse: /defaultfb <id>`);
        return res.sendStatus(200);
      }

      if (text.toLowerCase().startsWith("/defaultfb ")) {
        const id = Number(text.split(/\s+/)[1]);
        if (!Number.isInteger(id) || id <= 0) {
          await sendTelegramMessage(chatId, "Usage: /defaultfb <socialAccountId>");
          return res.sendStatus(200);
        }
        const user = await resolveTelegramUser(chatId);
        await storage.setDefaultSocialAccount(user.id, id);
        await sendTelegramMessage(chatId, `Default Facebook page set to account #${id}.`);
        return res.sendStatus(200);
      }

      if (text === "/status") {
        const user = await resolveTelegramUser(chatId);
        const linked = Boolean(user.telegramChatId && String(user.telegramChatId) === String(chatId));
        const creds = await storage.getEffectiveFacebookPageCredentials(user.id);
        const statusLines = [
          "Telegram agent is online.",
          `App user: ${user.username} (#${user.id})`,
          `Telegram linked to this chat: ${linked ? "yes" : "no (using fallback user)"}`,
          `Facebook ready: ${creds ? "yes" : "no"}`,
          creds ? `Active page id: ${creds.pageId}` : "",
        ].filter(Boolean);
        await sendTelegramMessage(chatId, statusLines.join("\n"));
        return res.sendStatus(200);
      }

      if (text.toLowerCase().startsWith("/myposts")) {
        const countRaw = text.split(/\s+/)[1];
        const count = Math.min(10, Math.max(1, Number(countRaw || "5")));
        const user = await resolveTelegramUser(chatId);
        const posts = await storage.getUserPosts(user.id, 1, count);
        if (!posts.length) {
          await sendTelegramMessage(chatId, "No posts found.");
          return res.sendStatus(200);
        }
        const lines = posts.slice(0, count).map((p) => `#${p.id} [${p.status}] ${p.content.slice(0, 60)}`);
        await sendTelegramMessage(chatId, `Latest posts:\n${lines.join("\n")}`);
        return res.sendStatus(200);
      }

      if (text.toLowerCase().startsWith("/deletepost ")) {
        const id = Number(text.split(/\s+/)[1]);
        if (!Number.isInteger(id) || id <= 0) {
          await sendTelegramMessage(chatId, "Usage: /deletepost <postId>");
          return res.sendStatus(200);
        }
        const user = await resolveTelegramUser(chatId);
        const post = await storage.getPost(id);
        if (!post || post.userId !== user.id) {
          await sendTelegramMessage(chatId, "Post not found or not owned by you.");
          return res.sendStatus(200);
        }
        const deleted = await storage.deletePost(id);
        await sendTelegramMessage(chatId, `Post #${deleted.id} deleted.`);
        return res.sendStatus(200);
      }

      if (text.toLowerCase().startsWith("/ai ")) {
        const prompt = text.slice(4).trim();
        if (!prompt) {
          await sendTelegramMessage(chatId, "Usage: /ai <prompt>");
          return res.sendStatus(200);
        }
        const aiText = await generateWithAi(prompt);
        await sendTelegramMessage(chatId, `AI draft:\n\n${aiText}`);
        return res.sendStatus(200);
      }

      if (text.toLowerCase().startsWith("/fbdraft ")) {
        const content = text.slice(9).trim();
        if (!content) {
          await sendTelegramMessage(chatId, "Usage: /fbdraft <text>");
          return res.sendStatus(200);
        }
        const user = await resolveTelegramUser(chatId);
        const { post } = await createFacebookTextPost(user, content, false);
        await sendTelegramMessage(chatId, `Draft saved.\nPost ID: ${post.id}`);
        return res.sendStatus(200);
      }

      if (text.toLowerCase().startsWith("/fb ")) {
        const content = text.slice(4).trim();
        if (!content) {
          await sendTelegramMessage(chatId, "Example:\n/fb Launching our new feature today!");
          return res.sendStatus(200);
        }
        const user = await resolveTelegramUser(chatId);
        const { post } = await createFacebookTextPost(user, content, true);
        await sendTelegramMessage(chatId, `Posted to Facebook Page.\nPost ID: ${post.id}`);
        return res.sendStatus(200);
      }

      await sendTelegramMessage(chatId, "Unsupported command.\n\n" + getHelpText());
      return res.sendStatus(200);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Unknown Telegram agent error";
      console.error("[TELEGRAM_WEBHOOK_ERROR]", messageText);
      await sendTelegramMessage(chatId, `Error: ${messageText}`).catch(() => {});
      return res.sendStatus(200);
    }
  });
}
