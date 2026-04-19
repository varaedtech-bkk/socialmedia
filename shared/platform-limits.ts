/**
 * Conservative limits aligned with common Graph / REST constraints so posts are less likely to fail.
 * Sources vary by product tier and API version — treat as guardrails, not legal guarantees.
 */

export const PLATFORM_DISPLAY_NAME: Record<string, string> = {
  "facebook-page": "Facebook Page",
  /** Not in API enum; kept for UI / legacy checks. */
  "facebook-personal": "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  "linkedin-page": "LinkedIn Page",
  twitter: "X (Twitter)",
  youtube: "YouTube",
  tiktok: "TikTok",
  pinterest: "Pinterest",
  snapchat: "Snapchat",
  whatsapp: "WhatsApp",
};

/** Max caption / post body length (characters) per platform for our publishing paths. */
export const PLATFORM_CAPTION_MAX_CHARS: Record<string, number> = {
  twitter: 280,
  instagram: 2200,
  linkedin: 3000,
  "linkedin-page": 3000,
  "facebook-page": 63206,
  "facebook-personal": 63206,
  youtube: 5000,
  tiktok: 2200,
  pinterest: 8000,
  snapchat: 250,
  whatsapp: 4096,
};

/** Max image file size (bytes) when posting to this platform (undefined = not used for image posts). */
export const PLATFORM_IMAGE_MAX_BYTES: Partial<Record<string, number>> = {
  twitter: 5 * 1024 * 1024,
  instagram: 8 * 1024 * 1024,
  "facebook-page": 10 * 1024 * 1024,
  "facebook-personal": 10 * 1024 * 1024,
  linkedin: 5 * 1024 * 1024,
  "linkedin-page": 5 * 1024 * 1024,
  whatsapp: 16 * 1024 * 1024,
  pinterest: 20 * 1024 * 1024,
  snapchat: 5 * 1024 * 1024,
  tiktok: 10 * 1024 * 1024,
};

/** Max video file size (bytes). */
export const PLATFORM_VIDEO_MAX_BYTES: Partial<Record<string, number>> = {
  twitter: 100 * 1024 * 1024,
  instagram: 100 * 1024 * 1024,
  "facebook-page": 256 * 1024 * 1024,
  "facebook-personal": 256 * 1024 * 1024,
  linkedin: 200 * 1024 * 1024,
  "linkedin-page": 200 * 1024 * 1024,
  youtube: 2 * 1024 * 1024 * 1024,
  whatsapp: 16 * 1024 * 1024,
  tiktok: 500 * 1024 * 1024,
  pinterest: 100 * 1024 * 1024,
  snapchat: 32 * 1024 * 1024,
};

/** Max PDF size for LinkedIn document posts (bytes). */
export const PLATFORM_PDF_MAX_BYTES: Partial<Record<string, number>> = {
  linkedin: 10 * 1024 * 1024,
  "linkedin-page": 10 * 1024 * 1024,
};

const WARN_FRACTION = 0.9;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function label(p: string): string {
  return PLATFORM_DISPLAY_NAME[p] ?? p;
}

/** Shortest caption limit among selected platforms (for a single shared caption). */
export function getStrictestCaptionLimit(platforms: readonly string[]): {
  maxChars: number;
  limitingPlatforms: string[];
} | null {
  let min = Infinity;
  const limiting: string[] = [];
  for (const p of platforms) {
    const m = PLATFORM_CAPTION_MAX_CHARS[p];
    if (m == null || !Number.isFinite(m)) continue;
    if (m < min) {
      min = m;
      limiting.length = 0;
      limiting.push(p);
    } else if (m === min) {
      limiting.push(p);
    }
  }
  if (min === Infinity) return null;
  return { maxChars: min, limitingPlatforms: limiting };
}

/** Matches server `captionForPlatform`: override wins when non-empty after trim. */
export function effectivePublishedCaption(
  platformId: string,
  content: string,
  contentOverrides?: Record<string, string> | null,
): string {
  const raw = contentOverrides?.[platformId];
  if (typeof raw === "string" && raw.trim().length > 0) return raw;
  return content;
}

export function validateCaptionsForTargets(args: {
  platforms: readonly string[];
  sharedContent: string;
  perPlatform: boolean;
  contentOverrides?: Record<string, string> | null;
}): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const p of args.platforms) {
    const text = !args.perPlatform
      ? args.sharedContent
      : effectivePublishedCaption(p, args.sharedContent, args.contentOverrides);
    const max = PLATFORM_CAPTION_MAX_CHARS[p];
    if (max == null) continue;

    if (text.length > max) {
      const key = `len:${p}`;
      if (!seen.has(key)) {
        seen.add(key);
        errors.push(
          `${label(p)}: text must be at most ${max.toLocaleString()} characters for this network (yours is ${text.length.toLocaleString()}).`,
        );
      }
    } else if (text.length > max * WARN_FRACTION) {
      warnings.push(`${label(p)}: approaching the ${max.toLocaleString()} character limit (${text.length}/${max}).`);
    }
  }

  return { errors, warnings };
}

export function validateMediaFilesForPlatforms(args: {
  files: ReadonlyArray<{ size: number; type?: string; mimetype?: string }>;
  platforms: readonly string[];
}): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const file of args.files) {
    const mime = (file.type || file.mimetype || "").toLowerCase();
    const kind = mime.startsWith("image/")
      ? "image"
      : mime.startsWith("video/")
        ? "video"
        : mime === "application/pdf"
          ? "pdf"
          : null;
    if (!kind) continue;

    const limitsMap =
      kind === "image" ? PLATFORM_IMAGE_MAX_BYTES : kind === "video" ? PLATFORM_VIDEO_MAX_BYTES : PLATFORM_PDF_MAX_BYTES;

    for (const p of args.platforms) {
      const max = limitsMap[p as keyof typeof limitsMap];
      if (max == null) continue;
      if (file.size > max) {
        errors.push(
          `${label(p)}: ${kind} must be about ${formatBytes(max)} or smaller for reliable publishing (this file is ${formatBytes(file.size)}).`,
        );
      } else if (file.size > max * WARN_FRACTION) {
        warnings.push(
          `${label(p)}: ${kind} is close to the ${formatBytes(max)} size limit (${formatBytes(file.size)}).`,
        );
      }
    }
  }

  return { errors, warnings };
}

/** Zod / API: caption length per target platform (shared or override). */
export function validateInsertPostPlatformRules(data: {
  content: string;
  platforms: readonly string[];
  contentOverrides?: Record<string, string> | null;
}): { message: string; path: (string | number)[] }[] {
  const issues: { message: string; path: (string | number)[] }[] = [];
  for (const p of data.platforms) {
    const text = effectivePublishedCaption(p, data.content, data.contentOverrides);
    const max = PLATFORM_CAPTION_MAX_CHARS[p];
    if (max == null) continue;
    if (text.length > max) {
      const rawOverride = data.contentOverrides?.[p];
      const hasOwn = typeof rawOverride === "string" && rawOverride.trim().length > 0;
      issues.push({
        message: `${label(p)} allows at most ${max.toLocaleString()} characters for this post (current: ${text.length.toLocaleString()}).`,
        path: hasOwn ? ["contentOverrides", p] : ["content"],
      });
    }
  }
  return issues;
}

export const MAX_POST_CONTENT_CHARS = Math.max(...Object.values(PLATFORM_CAPTION_MAX_CHARS));
