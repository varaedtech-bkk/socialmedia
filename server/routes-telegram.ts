import type { Express } from "express";
import fsp from "fs/promises";
import path from "path";
import { storage } from "./storage";
import { publishPost } from "./publishPost";
import { formatRemoteDeleteReply, removePublishedPostFromPlatforms } from "./remotePostDelete";
import { createTelegramBindToken } from "./telegram-link";
import {
  openRouterRequestHeaders,
  resolveOpenRouterApiKeyForUser,
} from "./openrouter-headers";
import { isTrialExpiredForUser } from "./trial-policy";
import type { Platform, User } from "@shared/schema";

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
    "Telegram Agent — publishing & accounts",
    "/connect — Link this chat to your web login",
    "/channels — Which networks are connected (FB, IG, WA, LI, YT)",
    "/accounts — All saved social accounts (pages, etc.)",
    "/defaultfb <id> — Default Facebook Page for /fb",
    "",
    "Text posts (no image):",
    "/fb <text> — Publish to Facebook Page",
    "/fbdraft <text> — Facebook draft only",
    "/li <text> — Publish to LinkedIn (personal)",
    "/lidraft <text> — LinkedIn draft only",
    "/post fb,li <text> — Same post to listed platforms (comma or +)",
    "/broadcast <text> — Post to all connected text platforms (FB + LI)",
    "",
    "Image from Telegram (caption = post text):",
    "Send a photo whose caption starts with:",
    "/igpost <optional caption> — Instagram (needs IG connected in web)",
    "/wapost <optional caption> — WhatsApp status (needs WA connected)",
    "",
    "Other:",
    "/status — Link + connection summary",
    "/myposts [n] — Latest posts (max 10)",
    "/deletepost <id> — Delete your post",
    "/ai <prompt> — AI draft (requires your own OpenRouter key in Integrations)",
    "/help — This list",
  ].join("\n");
}

async function resolveTelegramUser(chatId: number | string): Promise<User> {
  const mapped = await storage.getUserByAgentChannelIdentity("telegram", String(chatId));
  if (mapped) return mapped;
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

async function resolveTelegramCompanyContext(user: User) {
  return storage.getUserCompanyContext(user.id);
}

async function assertTelegramPlatformsAllowed(user: User, platforms: Platform[]): Promise<void> {
  const companyCtx = await resolveTelegramCompanyContext(user);
  const allowed = Array.isArray(companyCtx?.membership?.allowedPlatforms)
    ? companyCtx!.membership.allowedPlatforms
    : [];
  if (allowed.length === 0) return;
  const blocked = platforms.filter((p) => !allowed.includes(p));
  if (blocked.length > 0) {
    throw new Error(`Your company admin restricted these platforms: ${blocked.join(", ")}`);
  }
}

function publicBaseUrl(): string {
  return (process.env.CLIENT_URL || process.env.BASE_URL || "").replace(/\/$/, "");
}

/** Platforms publishPost supports for plain text today */
const TEXT_PUBLISH_PLATFORMS = new Set(["facebook-page", "linkedin"]);

/** Need image/video in post before publish */
const MEDIA_REQUIRED_PLATFORMS = new Set(["instagram", "whatsapp", "youtube"]);

const PLATFORM_ALIASES: Record<string, Platform> = {
  fb: "facebook-page",
  facebook: "facebook-page",
  "facebook-page": "facebook-page",
  ig: "instagram",
  instagram: "instagram",
  wa: "whatsapp",
  whatsapp: "whatsapp",
  li: "linkedin",
  linkedin: "linkedin",
};

function parsePlatformSlugs(slugCsv: string): Platform[] {
  const parts = slugCsv
    .split(/[,+]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const resolved: Platform[] = [];
  for (const p of parts) {
    const id = PLATFORM_ALIASES[p];
    if (!id) throw new Error(`Unknown platform code "${p}". Use: fb, ig, wa, li (comma-separated).`);
    if (!resolved.includes(id)) resolved.push(id);
  }
  return resolved;
}

function assertTelegramTextPlatforms(platforms: Platform[]): void {
  const mediaNeeded = platforms.filter((p) => MEDIA_REQUIRED_PLATFORMS.has(p));
  if (mediaNeeded.length) {
    throw new Error(
      `These platforms need media (image/video), not text-only from Telegram: ${mediaNeeded.join(", ")}. Use a photo caption with /igpost or /wapost, or the web app.`
    );
  }
  const unsupported = platforms.filter((p) => !TEXT_PUBLISH_PLATFORMS.has(p));
  if (unsupported.length) {
    throw new Error(
      `Not supported for text-only /post from Telegram yet: ${unsupported.join(", ")}. Use the web dashboard for LinkedIn Company, YouTube, etc.`
    );
  }
}

async function getConnectedTextPlatforms(user: User): Promise<Platform[]> {
  const out: Platform[] = [];
  if (await storage.getEffectiveFacebookPageCredentials(user.id)) {
    out.push("facebook-page");
  }
  if (user.linkedinToken && user.linkedinUserProfile) {
    out.push("linkedin");
  }
  return out;
}

async function buildChannelsLines(user: User): Promise<string[]> {
  const fb = Boolean(await storage.getEffectiveFacebookPageCredentials(user.id));
  const ig = Boolean(user.instagramToken && user.instagramBusinessAccountId);
  const wa = Boolean(user.whatsappToken && user.whatsappPhoneNumberId);
  const li = Boolean(user.linkedinToken && user.linkedinUserProfile);
  const lip = Boolean(user.linkedinPageToken && user.linkedinPageUrn);
  const yt = Boolean(user.youtubeToken && user.youtubeChannelId);
  return [
    `facebook-page (Page): ${fb ? "connected" : "not connected"}`,
    `instagram: ${ig ? "connected" : "not connected"}`,
    `whatsapp: ${wa ? "connected" : "not connected"}`,
    `linkedin (personal): ${li ? "connected" : "not connected"}`,
    `linkedin-page (org): ${lip ? "connected" : "not connected — use web to post"}`,
    `youtube: ${yt ? "connected" : "not connected"}`,
  ];
}

async function createAndPublishPost(
  user: User,
  platforms: Platform[],
  content: string,
  mediaUrls: string[],
  mediaType: "text" | "image" | "video",
  publishNow: boolean
) {
  await assertTelegramPlatformsAllowed(user, platforms);
  const post = await storage.createPost(user.id, {
    content,
    scheduledTime: null,
    platforms,
    mediaUrls,
    mediaType,
    timezone: "UTC",
    status: "draft",
    analytics: { impressions: 0, clicks: 0, likes: 0, shares: 0, comments: 0 },
    contentOverrides: {},
  });

  if (publishNow) {
    await publishPost(post.id);
  }
  return post;
}

async function createFacebookTextPost(user: User, content: string, publishNow: boolean) {
  const creds = await storage.getEffectiveFacebookPageCredentials(user.id);
  if (!creds) {
    throw new Error("No Facebook Page connected. Connect in the web app (Facebook Page) first.");
  }
  const post = await createAndPublishPost(user, ["facebook-page"], content, [], "text", publishNow);
  return { post };
}

async function createLinkedinTextPost(user: User, content: string, publishNow: boolean) {
  if (!user.linkedinToken || !user.linkedinUserProfile) {
    throw new Error("LinkedIn not connected. Connect LinkedIn in the web app first.");
  }
  const post = await createAndPublishPost(user, ["linkedin"], content, [], "text", publishNow);
  return { post };
}

async function saveTelegramPhotoToUpload(photo: { file_id: string }[]): Promise<string> {
  if (!photo?.length) throw new Error("No photo in message");
  const fileId = photo[photo.length - 1].file_id;
  const botToken = getRequiredEnv("TELEGRAM_BOT_TOKEN");
  const metaRes = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`
  );
  const meta = (await metaRes.json()) as { ok?: boolean; result?: { file_path?: string } };
  const filePath = meta.result?.file_path;
  if (!meta.ok || !filePath) {
    throw new Error("Could not resolve Telegram photo file");
  }
  const fileRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
  if (!fileRes.ok) throw new Error("Failed to download photo from Telegram");
  const buf = Buffer.from(await fileRes.arrayBuffer());
  const maxBytes = 12 * 1024 * 1024;
  if (buf.length > maxBytes) throw new Error("Photo is too large (max 12MB)");
  const ext = path.extname(filePath) || ".jpg";
  const name = `telegram-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const diskPath = path.join(process.cwd(), "uploads", name);
  await fsp.mkdir(path.dirname(diskPath), { recursive: true });
  await fsp.writeFile(diskPath, buf);
  return `/uploads/${name}`;
}

async function generateWithAi(prompt: string, user: User): Promise<string> {
  const companyCtx = await resolveTelegramCompanyContext(user);
  const companyTier = companyCtx?.company?.packageTier === "advance" ? "advance" : "basic";
  const aiEnabled = companyCtx?.membership?.aiEnabled ?? true;
  const trialExpired = isTrialExpiredForUser(user);
  if (user.role !== "super_admin" && companyTier !== "advance") {
    throw new Error("AI is available only on Advance company plan. Ask your company admin to upgrade.");
  }
  if (trialExpired) {
    throw new Error("Your 7-day trial ended. Open Billing in the web app and complete Stripe checkout.");
  }
  if (!aiEnabled) {
    throw new Error("AI is disabled for your member account by a company admin.");
  }
  const apiKey = resolveOpenRouterApiKeyForUser(user, companyCtx?.company?.openrouterApiKey ?? null);
  if (!apiKey) {
    throw new Error("No OpenRouter key: add your own API key in Integrations.");
  }
  const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: openRouterRequestHeaders(apiKey),
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
    const raw = result?.error?.message || "AI generation failed";
    if (response.status === 401 || String(raw).toLowerCase().includes("user not found")) {
      const hint = user.openrouterApiKey
        ? "OpenRouter rejected your API key. Update it in the web app: Integrations."
        : "No OpenRouter key found. Add your key in the web app under Integrations.";
      throw new Error(hint);
    }
    throw new Error(raw);
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
    const rawText = (message?.text || "").trim();
    const caption = (message?.caption || "").trim();
    const photo = message?.photo as { file_id: string }[] | undefined;

    if (!chatId) {
      return res.sendStatus(200);
    }

    const allowedChatId = process.env.TELEGRAM_CHAT_ID;
    if (allowedChatId && String(chatId) !== String(allowedChatId)) {
      return res.sendStatus(200);
    }

    try {
      if (photo?.length && caption) {
        const cap = caption.trim();
        let userPhoto: User;
        try {
          userPhoto = await resolveTelegramUser(chatId);
        } catch (linkErr) {
          await sendTelegramMessage(
            chatId,
            linkErr instanceof Error ? linkErr.message : "Link this chat with /connect first."
          ).catch(() => {});
          return res.sendStatus(200);
        }

        if (/^\/igpost\b/i.test(cap)) {
          const content = cap.replace(/^\/igpost(?:@\S+)?\s*/i, "").trim() || " ";
          if (!userPhoto.instagramToken || !userPhoto.instagramBusinessAccountId) {
            await sendTelegramMessage(chatId, "Instagram not connected. Connect Instagram in the web app first.");
            return res.sendStatus(200);
          }
          const mediaPath = await saveTelegramPhotoToUpload(photo);
          const post = await createAndPublishPost(
            userPhoto,
            ["instagram"],
            content,
            [mediaPath],
            "image",
            true
          );
          await sendTelegramMessage(chatId, `Posted to Instagram.\nPost ID: ${post.id}`);
          return res.sendStatus(200);
        }

        if (/^\/wapost\b/i.test(cap)) {
          const content = cap.replace(/^\/wapost(?:@\S+)?\s*/i, "").trim() || " ";
          if (!userPhoto.whatsappToken || !userPhoto.whatsappPhoneNumberId) {
            await sendTelegramMessage(chatId, "WhatsApp not connected. Connect WhatsApp in the web app first.");
            return res.sendStatus(200);
          }
          const mediaPath = await saveTelegramPhotoToUpload(photo);
          const post = await createAndPublishPost(
            userPhoto,
            ["whatsapp"],
            content,
            [mediaPath],
            "image",
            true
          );
          await sendTelegramMessage(chatId, `Posted to WhatsApp.\nPost ID: ${post.id}`);
          return res.sendStatus(200);
        }
      }

      const text = rawText;
      if (!text) {
        return res.sendStatus(200);
      }

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
          `Open this link in your browser, log in with the account your admin created, and your Telegram will be linked:\n\n${url}\n\nThen use /fb, /post, /broadcast, or photo + /igpost.`
        );
        return res.sendStatus(200);
      }

      if (text === "/channels") {
        const user = await resolveTelegramUser(chatId);
        const lines = await buildChannelsLines(user);
        await sendTelegramMessage(chatId, ["Connected platforms:", ...lines].join("\n"));
        return res.sendStatus(200);
      }

      if (text === "/accounts") {
        const user = await resolveTelegramUser(chatId);
        const accounts = await storage.listSocialAccounts(user.id);
        if (!accounts.length) {
          await sendTelegramMessage(
            chatId,
            "No social accounts stored yet. Connect Facebook Page, etc. in the web dashboard."
          );
          return res.sendStatus(200);
        }
        const lines = accounts.map(
          (a) =>
            `#${a.id} [${a.platform}] ${a.isDefault ? "(default) " : ""}${a.displayName || "—"} — ${a.externalId}`
        );
        await sendTelegramMessage(
          chatId,
          `Social accounts:\n${lines.join("\n")}\n\nFacebook default page: /defaultfb <id>`
        );
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
        const ch = await buildChannelsLines(user);
        const statusLines = [
          "Telegram agent online.",
          `App user: ${user.username} (#${user.id})`,
          `Telegram ↔ chat linked: ${linked ? "yes" : "no (fallback TELEGRAM_DEFAULT_USER_ID)"}`,
          creds ? `Active Facebook page id: ${creds.pageId}` : "Facebook Page: not configured for posting",
          "",
          ...ch,
        ];
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
        const remoteDeletion = await removePublishedPostFromPlatforms(post, user);
        const deleted = await storage.deletePost(id);
        const summary = formatRemoteDeleteReply(remoteDeletion);
        await sendTelegramMessage(chatId, `Post #${deleted.id}\n\n${summary}`);
        return res.sendStatus(200);
      }

      const postMatch = text.match(/^\/post(?:@\S+)?\s+([a-z0-9+,]+)\s+([\s\S]+)$/i);
      if (postMatch) {
        const slugCsv = postMatch[1];
        const content = postMatch[2].trim();
        if (!content) {
          await sendTelegramMessage(chatId, "Usage: /post fb,li Your post text here");
          return res.sendStatus(200);
        }
        const user = await resolveTelegramUser(chatId);
        const platforms = parsePlatformSlugs(slugCsv);
        assertTelegramTextPlatforms(platforms);
        const post = await createAndPublishPost(user, platforms, content, [], "text", true);
        await sendTelegramMessage(
          chatId,
          `Published to: ${platforms.join(", ")}\nPost ID: ${post.id}`
        );
        return res.sendStatus(200);
      }

      const bcMatch = text.match(/^\/broadcast(?:@\S+)?\s+([\s\S]+)$/i);
      if (bcMatch) {
        const content = bcMatch[1].trim();
        if (!content) {
          await sendTelegramMessage(chatId, "Usage: /broadcast Your post text (all connected FB + LinkedIn)");
          return res.sendStatus(200);
        }
        const user = await resolveTelegramUser(chatId);
        const platforms = await getConnectedTextPlatforms(user);
        if (!platforms.length) {
          await sendTelegramMessage(
            chatId,
            "No text-capable platforms connected. Connect Facebook Page and/or LinkedIn in the web app."
          );
          return res.sendStatus(200);
        }
        const post = await createAndPublishPost(user, platforms, content, [], "text", true);
        await sendTelegramMessage(
          chatId,
          `Broadcast to: ${platforms.join(", ")}\nPost ID: ${post.id}`
        );
        return res.sendStatus(200);
      }

      if (/^\/lidraft(?:@\S+)?\s*/i.test(text)) {
        const content = text.replace(/^\/lidraft(?:@\S+)?\s*/i, "").trim();
        if (!content) {
          await sendTelegramMessage(chatId, "Usage: /lidraft <text>");
          return res.sendStatus(200);
        }
        const user = await resolveTelegramUser(chatId);
        const { post } = await createLinkedinTextPost(user, content, false);
        await sendTelegramMessage(chatId, `LinkedIn draft saved.\nPost ID: ${post.id}`);
        return res.sendStatus(200);
      }

      if (/^\/li(?:@\S+)?\s+/i.test(text)) {
        const content = text.replace(/^\/li(?:@\S+)?\s*/i, "").trim();
        if (!content) {
          await sendTelegramMessage(chatId, "Usage: /li <text>");
          return res.sendStatus(200);
        }
        const user = await resolveTelegramUser(chatId);
        const { post } = await createLinkedinTextPost(user, content, true);
        await sendTelegramMessage(chatId, `Published to LinkedIn.\nPost ID: ${post.id}`);
        return res.sendStatus(200);
      }

      if (text.toLowerCase().startsWith("/ai ")) {
        const prompt = text.slice(4).trim();
        if (!prompt) {
          await sendTelegramMessage(chatId, "Usage: /ai <prompt>");
          return res.sendStatus(200);
        }
        const user = await resolveTelegramUser(chatId);
        const aiText = await generateWithAi(prompt, user);
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
