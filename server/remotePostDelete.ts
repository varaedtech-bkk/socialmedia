import axios from "axios";
import type { Post, User } from "@shared/schema";
import { storage } from "./storage";

export type RemotePostDeleteResult = {
  removedRemotely: string[];
  skippedNoRemoteId: string[];
  failed: { platform: string; error: string }[];
  notes: string[];
};

/**
 * Best-effort removal on each network before soft-deleting the row.
 * Older posts may lack analytics.platformIds (nothing to call remotely).
 */
export async function removePublishedPostFromPlatforms(
  post: Post,
  user: User
): Promise<RemotePostDeleteResult> {
  const analytics = post.analytics as {
    platformIds?: Record<string, string>;
  } | null;
  const platformIds = analytics?.platformIds || {};
  const platforms = Array.isArray(post.platforms) ? (post.platforms as string[]) : [];

  const removedRemotely: string[] = [];
  const skippedNoRemoteId: string[] = [];
  const failed: { platform: string; error: string }[] = [];
  const notes: string[] = [];

  for (const platform of platforms) {
    const remoteId = platformIds[platform];
    if (!remoteId) {
      skippedNoRemoteId.push(platform);
      continue;
    }

    if (platform === "facebook-page") {
      try {
        const creds = await storage.getEffectiveFacebookPageCredentials(user.id);
        if (!creds?.pageToken) throw new Error("No Facebook Page token");
        await axios.delete(`https://graph.facebook.com/v22.0/${remoteId}`, {
          params: { access_token: creds.pageToken },
        });
        removedRemotely.push("facebook-page");
      } catch (e) {
        const msg = axios.isAxiosError(e)
          ? (e.response?.data as { error?: { message?: string } })?.error?.message || e.message
          : String(e);
        failed.push({ platform: "Facebook Page", error: msg });
      }
      continue;
    }

    if (platform === "instagram") {
      try {
        if (!user.instagramToken) throw new Error("No Instagram token");
        await axios.delete(`https://graph.instagram.com/v22.0/${remoteId}`, {
          params: { access_token: user.instagramToken },
        });
        removedRemotely.push("instagram");
      } catch (e) {
        const msg = axios.isAxiosError(e)
          ? (e.response?.data as { error?: { message?: string } })?.error?.message || e.message
          : String(e);
        failed.push({ platform: "Instagram", error: msg });
        notes.push(
          "Instagram: Meta often does not allow deleting feed media via API. If delete failed, remove the post in the Instagram app."
        );
      }
      continue;
    }

    notes.push(`No automatic remote delete for platform "${platform}" (stored id: ${remoteId}).`);
  }

  return {
    removedRemotely,
    skippedNoRemoteId,
    failed,
    notes: [...new Set(notes)],
  };
}

/** User-facing summary for Telegram (keep under ~3500 chars). */
export function formatRemoteDeleteReply(r: RemotePostDeleteResult): string {
  const parts: string[] = ["Removed from your app (database)."];
  if (r.removedRemotely.length) {
    parts.push(`Also removed on the network: ${r.removedRemotely.join(", ")}.`);
  }
  if (r.failed.length) {
    parts.push(
      `Network delete failed: ${r.failed.map((f) => `${f.platform}: ${f.error.slice(0, 200)}`).join(" | ")}`
    );
  }
  if (r.notes.length) {
    parts.push([...new Set(r.notes)].join(" "));
  }
  if (r.skippedNoRemoteId.length) {
    parts.push(
      `No stored API id for: ${r.skippedNoRemoteId.join(", ")} (older posts or draft). Delete on the network manually if it still appears.`
    );
  }
  return parts.join("\n").slice(0, 3900);
}
