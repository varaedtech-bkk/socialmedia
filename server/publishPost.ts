import axios from "axios";
import sharp from "sharp";
import { uploadMediaToPlatforms } from "./uploadToMedia";
import { storage } from "./storage";
import fsp from "fs/promises"; // fs/promises for other operations
import fs from "fs"; // fs for createReadStream
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const INSTAGRAM_CAPTION_MAX = 2200;

function instagramGraphErrorPayload(error: unknown): {
  message?: string;
  code?: number;
  is_transient?: boolean;
  httpStatus?: number;
} | null {
  if (!axios.isAxiosError(error)) return null;
  const ig = error.response?.data?.error as
    | { message?: string; code?: number; is_transient?: boolean }
    | undefined;
  if (ig && typeof ig === "object") {
    return {
      ...ig,
      httpStatus: error.response?.status,
    };
  }
  return {
    message: error.message,
    httpStatus: error.response?.status,
  };
}

function isInstagramRetryableError(error: unknown): boolean {
  const ig = instagramGraphErrorPayload(error);
  if (!ig) return false;
  if (ig.is_transient) return true;
  if (ig.code === 1 || ig.code === 2) return true;
  if (ig.httpStatus != null && ig.httpStatus >= 500) return true;
  const msg = (ig.message || "").toLowerCase();
  if (msg.includes("unexpected error") && (msg.includes("retry") || msg.includes("later"))) return true;
  if (msg.includes("try again later")) return true;
  if (msg.includes("please retry")) return true;
  if (msg.includes("service temporarily unavailable")) return true;
  return false;
}

function instagramUserFacingErrorMessage(error: unknown): string {
  const ig = instagramGraphErrorPayload(error);
  if (ig && isInstagramRetryableError(error)) {
    return "Instagram is temporarily unavailable. Please try again in a minute.";
  }
  if (axios.isAxiosError(error)) {
    const full = error.response?.data?.error as
      | { message?: string; error_user_msg?: string; code?: number }
      | undefined;
    if (full?.code === 9007 && typeof full.error_user_msg === "string" && full.error_user_msg.trim()) {
      return full.error_user_msg.trim();
    }
  }
  return ig?.message || (error instanceof Error ? error.message : "Failed to post to Instagram");
}

function pathnameLowerFromUrlOrPath(urlOrPath: string): string {
  try {
    if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) {
      return new URL(urlOrPath).pathname.toLowerCase();
    }
  } catch {
    /* fall through */
  }
  return (urlOrPath.split("?")[0] || "").toLowerCase();
}

/** Instagram `image_url` publishing is most reliable with JPEG; PNG/WebP often yields generic Meta 500/code 2. */
async function prepareInstagramImageUrlForPublishing(args: {
  postId: number;
  mediaUrl: string;
  publicMediaUrl: string;
}): Promise<{ imageUrl: string; cleanup: () => Promise<void> }> {
  const baseUrl = (process.env.BASE_URL || "https://siamshoppinghub.com").replace(/\/$/, "");
  const pathKey = pathnameLowerFromUrlOrPath(args.publicMediaUrl);

  if (pathKey.endsWith(".jpg") || pathKey.endsWith(".jpeg")) {
    return { imageUrl: args.publicMediaUrl, cleanup: async () => {} };
  }

  const resolveLocalUploadBuffer = async (): Promise<Buffer | null> => {
    const relFromMedia =
      args.mediaUrl.startsWith("/uploads/") ? args.mediaUrl.slice(1) : null;
    if (relFromMedia) {
      const diskPath = path.join(process.cwd(), relFromMedia);
      return fsp.readFile(diskPath);
    }
    if (args.publicMediaUrl.startsWith(`${baseUrl}/`)) {
      try {
        const p = new URL(args.publicMediaUrl).pathname.replace(/^\//, "");
        if (p.startsWith("uploads/")) {
          return fsp.readFile(path.join(process.cwd(), p));
        }
      } catch {
        return null;
      }
    }
    return null;
  };

  let inputBuffer = await resolveLocalUploadBuffer();
  if (!inputBuffer) {
    const res = await axios.get<ArrayBuffer>(args.publicMediaUrl, {
      responseType: "arraybuffer",
      timeout: 45000,
      maxContentLength: 12 * 1024 * 1024,
      headers: { "User-Agent": "facebookexternalhit/1.1" },
      validateStatus: () => true,
    });
    if (res.status >= 400) {
      throw new Error(
        `Image URL returned HTTP ${res.status}. Instagram must fetch your image over public HTTPS (no login wall). URL: ${args.publicMediaUrl}`
      );
    }
    inputBuffer = Buffer.from(res.data);
  }

  const INSTAGRAM_MIN_EDGE_PX = 320;
  const INSTAGRAM_MAX_EDGE_PX = 1440;

  let jpegBuf: Buffer;
  try {
    jpegBuf = await sharp(inputBuffer)
      .rotate()
      .resize(INSTAGRAM_MAX_EDGE_PX, INSTAGRAM_MAX_EDGE_PX, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();

    const meta = await sharp(jpegBuf).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w > 0 && h > 0 && Math.min(w, h) < INSTAGRAM_MIN_EDGE_PX) {
      jpegBuf = await sharp(jpegBuf)
        .resize(INSTAGRAM_MIN_EDGE_PX, INSTAGRAM_MIN_EDGE_PX, { fit: "outside" })
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer();
      const m2 = await sharp(jpegBuf).metadata();
      console.log(
        `📸 Instagram: Upscaled image to meet Meta minimum (${INSTAGRAM_MIN_EDGE_PX}px short edge): ${m2.width}x${m2.height}`
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Could not prepare image for Instagram (convert to JPEG): ${msg}`);
  }

  const outName = `ig-publish-${args.postId}-${Date.now()}.jpg`;
  const outRel = path.join("uploads", outName);
  const outPath = path.join(process.cwd(), outRel);
  await fsp.mkdir(path.dirname(outPath), { recursive: true });
  await fsp.writeFile(outPath, jpegBuf);

  const imageUrl = `${baseUrl}/uploads/${outName}`;
  return {
    imageUrl,
    cleanup: async () => {
      await fsp.unlink(outPath).catch(() => {});
    },
  };
}

/**
 * Instagram often needs the container in FINISHED state before media_publish.
 * Publishing immediately after create can return OAuthException 9007 "Media ID is not available".
 */
async function waitForInstagramMediaContainerReady(
  creationId: string,
  accessToken: string,
  kind: "image" | "video"
): Promise<void> {
  const pollIntervalMs = kind === "video" ? 10_000 : 2_000;
  const maxAttempts = kind === "video" ? 30 : 45;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) {
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }

    const statusResponse = await axios.get(`https://graph.instagram.com/v22.0/${creationId}`, {
      params: { fields: "status_code", access_token: accessToken },
    });

    const raw = statusResponse.data?.status_code;
    const status = typeof raw === "string" ? raw : "IN_PROGRESS";

    console.log(`📸 Instagram: ${kind} container status: ${status} (poll ${attempt}/${maxAttempts})`);

    if (status === "FINISHED") {
      return;
    }
    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(`Instagram could not process this media (status: ${status}). Try another image or format.`);
    }
  }

  throw new Error(
    "Instagram media did not become ready in time. Try again in a minute, or use a smaller JPEG/PNG under 8MB."
  );
}

function isInstagramMediaPublishNotReadyError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const e = error.response?.data?.error as
    | { code?: number; error_subcode?: number; message?: string }
    | undefined;
  if (!e) return false;
  if (e.code === 9007) return true;
  if (e.error_subcode === 2207027) return true;
  return (e.message || "").toLowerCase().includes("media id is not available");
}

/**
 * Instagram can return FINISHED on the container while media_publish still answers 9007
 * ("Media ID is not available") for a short window. Settle + retry publish only.
 */
async function publishInstagramMediaContainer(
  igUserId: string,
  creationId: string,
  accessToken: string
): Promise<string> {
  await new Promise((r) => setTimeout(r, 4000));
  console.log("📸 Instagram: Settled after FINISHED; calling media_publish");

  const delaysBetweenPublishAttemptsMs = [0, 3500, 5000, 7000, 9000, 11000, 13000, 16000];
  let lastError: unknown;

  for (let i = 0; i < delaysBetweenPublishAttemptsMs.length; i++) {
    if (delaysBetweenPublishAttemptsMs[i] > 0) {
      console.log(
        `📸 Instagram: Waiting ${delaysBetweenPublishAttemptsMs[i]}ms before media_publish retry (${i + 1}/${delaysBetweenPublishAttemptsMs.length})`
      );
      await new Promise((r) => setTimeout(r, delaysBetweenPublishAttemptsMs[i]));
    }

    try {
      const publishForm = new URLSearchParams({
        creation_id: creationId,
        access_token: accessToken,
      });
      const publishResponse = await axios.post(
        `https://graph.instagram.com/v22.0/${igUserId}/media_publish`,
        publishForm.toString(),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
      );

      const mediaId = publishResponse.data.id;
      if (!mediaId) {
        throw new Error(publishResponse.data.error?.message || "Failed to publish Instagram media");
      }
      return mediaId;
    } catch (error) {
      lastError = error;
      if (isInstagramMediaPublishNotReadyError(error) && i < delaysBetweenPublishAttemptsMs.length - 1) {
        console.warn("📸 Instagram: media_publish returned not-ready; retrying after backoff");
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

export const publishPost = async (postId: number) => {
  const post = await storage.getPost(postId);
  if (!post) {
    throw new Error("Post not found");
  }

  const user = await storage.getUser(post.userId);
  if (!user) {
    throw new Error("User not found");
  }

  const errors: { platform: string; error: string }[] = [];

  // Ensure platforms is an array
  if (!Array.isArray(post.platforms)) {
    throw new Error("Platforms must be an array");
  }

  // Ensure mediaUrls is an array of strings
  if (!Array.isArray(post.mediaUrls)) {
    throw new Error("mediaUrls must be an array of strings");
  }

  // Ensure mediaType is not null
  if (post.mediaType === null) {
    throw new Error("mediaType cannot be null");
  }

  const mediaType = post.mediaType as "text" | "image" | "video" | "pdf"; // Type assertion

  /** Graph API ids for DELETE on Facebook / Instagram (saved to analytics when publish succeeds) */
  const platformRemoteIds: Record<string, string> = {};

  for (const platform of post.platforms) {
    try {
      switch (platform) {
        case "facebook-page": {
          const fbCreds = await storage.getEffectiveFacebookPageCredentials(post.userId);
          if (!fbCreds) {
            errors.push({
              platform: "Facebook Page",
              error: "Facebook Page not connected",
            });
            break;
          }

          // Skip PDF uploads for Facebook
          if (mediaType === "pdf") {
            errors.push({
              platform: "Facebook Page",
              error: "PDF uploads are not supported on Facebook",
            });
            break;
          }

          const fbPageEndpoint = `https://graph.facebook.com/v22.0/${fbCreds.pageId}/feed`;
          let fbPageData: any = {
            message: post.content,
            access_token: fbCreds.pageToken,
          };

          if (mediaType === "image" || mediaType === "video") {
            const mediaIds = await uploadMediaToPlatforms(
              fbCreds.pageToken,
              fbCreds.pageId,
              post.mediaUrls as string[], // Type assertion
              mediaType,
              "facebook" // Specify the platform
            );
            fbPageData.attached_media = mediaIds;
          }

          const fbPageResponse = await axios.post(fbPageEndpoint, fbPageData, {
            headers: { "Content-Type": "application/json" },
          });

          if (!fbPageResponse.data || fbPageResponse.data.error) {
            errors.push({
              platform: "Facebook Page",
              error: fbPageResponse.data.error?.message || "Facebook API error",
            });
          } else {
            const fbId = fbPageResponse.data.id;
            if (fbId) platformRemoteIds["facebook-page"] = String(fbId);
            console.log(`✅ Successfully posted to Facebook Page: ${fbId}`);
          }
          break;
        }

      case "instagram":
        // Instagram API with Instagram Login
        // Docs: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/
        if (!user.instagramToken || !user.instagramBusinessAccountId) {
          errors.push({
            platform: "Instagram",
            error: "Instagram not connected. Please connect your Instagram Business/Creator account.",
          });
          break;
        }

        // Instagram requires media (text-only posts not supported)
        if (mediaType !== "image" && mediaType !== "video") {
          errors.push({
            platform: "Instagram",
            error: "Instagram posts must include an image or video. Text-only posts are not supported.",
          });
          break;
        }

        try {
          const mediaUrls = post.mediaUrls as string[];
          if (!mediaUrls || mediaUrls.length === 0) {
            throw new Error("No media files provided for Instagram post");
          }

          // Get the first media URL (Instagram single post)
          const mediaUrl = mediaUrls[0];
          const baseUrl = process.env.BASE_URL || "https://siamshoppinghub.com";
          const publicMediaUrl = mediaUrl.startsWith("http")
            ? mediaUrl
            : `${baseUrl}${mediaUrl}`;

          const rawCaption = post.content || "";
          const caption =
            rawCaption.length > INSTAGRAM_CAPTION_MAX
              ? rawCaption.slice(0, INSTAGRAM_CAPTION_MAX)
              : rawCaption;
          if (rawCaption.length > INSTAGRAM_CAPTION_MAX) {
            console.warn(
              `📸 Instagram: Caption truncated from ${rawCaption.length} to ${INSTAGRAM_CAPTION_MAX} characters`
            );
          }

          const igProfile = user.instagramUserProfile as { user_id?: string } | null | undefined;
          const igUserId = (igProfile?.user_id || user.instagramBusinessAccountId)!.toString();

          let imageUrlForInstagram = publicMediaUrl;
          let cleanupInstagramTempImage: (() => Promise<void>) | null = null;
          if (mediaType === "image") {
            const prepared = await prepareInstagramImageUrlForPublishing({
              postId: post.id,
              mediaUrl,
              publicMediaUrl,
            });
            imageUrlForInstagram = prepared.imageUrl;
            cleanupInstagramTempImage = prepared.cleanup;
            if (imageUrlForInstagram !== publicMediaUrl) {
              console.log(
                "📸 Instagram: Normalized image to JPEG for publishing:",
                publicMediaUrl,
                "→",
                imageUrlForInstagram
              );
            }
          }

          const maxAttempts = 5;
          const retryDelaysMs = [2000, 4000, 8000, 12000, 16000];
          let lastError: unknown;

          try {
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
              try {
                console.log(
                  `📸 Instagram: Creating media container (attempt ${attempt}/${maxAttempts}) for:`,
                  imageUrlForInstagram
                );

                const createMediaParams: Record<string, string> = {
                  access_token: user.instagramToken,
                  caption,
                };

                if (mediaType === "image") {
                  createMediaParams.image_url = imageUrlForInstagram;
                } else if (mediaType === "video") {
                  createMediaParams.video_url = publicMediaUrl;
                  createMediaParams.media_type = "REELS";
                }

                const createForm = new URLSearchParams(createMediaParams);
                const createMediaResponse = await axios.post(
                  `https://graph.instagram.com/v22.0/${igUserId}/media`,
                  createForm.toString(),
                  {
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                  }
                );

                const creationId = createMediaResponse.data.id;
                if (!creationId) {
                  throw new Error(
                    createMediaResponse.data.error?.message || "Failed to create Instagram media container"
                  );
                }

                console.log("📸 Instagram: Media container created:", creationId);

                await waitForInstagramMediaContainerReady(
                  creationId,
                  user.instagramToken,
                  mediaType === "video" ? "video" : "image"
                );

                const mediaId = await publishInstagramMediaContainer(
                  igUserId,
                  creationId,
                  user.instagramToken
                );

                console.log("✅ Instagram: Post published successfully:", mediaId);
                if (mediaId) platformRemoteIds["instagram"] = String(mediaId);
                lastError = null;
                break;
              } catch (error) {
                lastError = error;
                const igError = instagramGraphErrorPayload(error);
                const shouldRetry = attempt < maxAttempts && isInstagramRetryableError(error);

                console.error(
                  `❌ Instagram attempt ${attempt} failed:`,
                  igError || (error instanceof Error ? error.message : error)
                );

                if (!shouldRetry) break;
                await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt - 1]));
              }
            }

            if (lastError) {
              throw lastError;
            }
          } finally {
            if (cleanupInstagramTempImage) {
              await cleanupInstagramTempImage().catch(() => {});
            }
          }
        } catch (error) {
          if (axios.isAxiosError(error)) {
            console.error("❌ Instagram API Error:", instagramGraphErrorPayload(error) || error.message);
            errors.push({
              platform: "Instagram",
              error: instagramUserFacingErrorMessage(error),
            });
          } else {
            console.error("❌ Instagram posting error:", error);
            errors.push({
              platform: "Instagram",
              error: error instanceof Error ? error.message : "Failed to post to Instagram",
            });
          }
        }
        break;

        case "linkedin":
          if (!user.linkedinToken || !user.linkedinUserProfile) {
            throw new Error("LinkedIn not connected");
          }

          try {
            const linkedinProfile = user.linkedinUserProfile as { sub?: string };
            if (!linkedinProfile?.sub) {
              throw new Error("LinkedIn profile missing user ID");
            }

            let registerUpload;
            let uploadData;
            const mediaAssets = [];

            if (mediaType !== "text") {
              for (const mediaUrl of post.mediaUrls as string[]) {
                // Type assertion
                const filePath = path.join(__dirname, "..", mediaUrl);
                registerUpload = await fetch(
                  "https://api.linkedin.com/v2/assets?action=registerUpload",
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${user.linkedinToken}`,
                      "X-Restli-Protocol-Version": "2.0.0",
                    },
                    body: JSON.stringify({
                      registerUploadRequest: {
                        recipes: [
                          mediaType === "video"
                            ? "urn:li:digitalmediaRecipe:feedshare-video"
                            : mediaType === "pdf"
                            ? "urn:li:digitalmediaRecipe:feedshare-document"
                            : "urn:li:digitalmediaRecipe:feedshare-image",
                        ],
                        owner: `urn:li:person:${linkedinProfile.sub}`,
                        serviceRelationships: [
                          {
                            relationshipType: "OWNER",
                            identifier: "urn:li:userGeneratedContent",
                          },
                        ],
                      },
                    }),
                  }
                );
                if (!registerUpload.ok) {
                  const error = await registerUpload.json();
                  console.error(
                    "LinkedIn API Error (Register Upload):",
                    JSON.stringify(error, null, 2)
                  );
                  throw new Error(
                    error.message || "LinkedIn media registration failed"
                  );
                }

                uploadData = await registerUpload.json();

                const upload = await fetch(
                  uploadData.value.uploadMechanism[
                    "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
                  ].uploadUrl,
                  {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${user.linkedinToken}`,
                    },
                    body: await fsp.readFile(filePath),
                  }
                );

                if (!upload.ok) {
                  throw new Error("LinkedIn media upload failed");
                }

                mediaAssets.push({
                  status: "READY",
                  media: uploadData.value.asset,
                });
              }
            }

            const postData = {
              author: `urn:li:person:${linkedinProfile.sub}`,
              lifecycleState: "PUBLISHED",
              specificContent: {
                "com.linkedin.ugc.ShareContent": {
                  shareCommentary: {
                    text: post.content,
                  },
                  shareMediaCategory:
                    mediaType === "text" ? "NONE" : mediaType.toUpperCase(),
                  ...(mediaType !== "text" && {
                    media: mediaAssets,
                  }),
                },
              },
              visibility: {
                "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
              },
            };

            const linkedinResponse = await fetch(
              "https://api.linkedin.com/v2/ugcPosts",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${user.linkedinToken}`,
                  "X-Restli-Protocol-Version": "2.0.0",
                },
                body: JSON.stringify(postData),
              }
            );

            if (!linkedinResponse.ok) {
              const error = await linkedinResponse.json();
              console.error("LinkedIn API Error:", error);
              throw new Error(error.message || "LinkedIn API error");
            }
          } catch (platformError) {
            console.error("Failed to post to LinkedIn:", platformError);
            await storage.updatePostStatus(post.id, "error_linkedin");
            continue;
          }
          break;

        case "whatsapp":
          // WhatsApp Business API - Status Posting
          // Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages
          if (!user.whatsappToken || !user.whatsappPhoneNumberId) {
            errors.push({
              platform: "WhatsApp",
              error: "WhatsApp not connected. Please connect your WhatsApp Business Account.",
            });
            break;
          }

          try {
            // WhatsApp Status API - Post status update
            // Note: WhatsApp Status is ephemeral (24 hours) and requires media
            const mediaUrls = post.mediaUrls as string[];
            
            if (!mediaUrls || mediaUrls.length === 0) {
              errors.push({
                platform: "WhatsApp",
                error: "WhatsApp Status requires media (image or video). Text-only status is not supported.",
              });
              break;
            }

            // Get the first media URL (WhatsApp Status supports single media)
            const mediaUrl = mediaUrls[0];
            const baseUrl = process.env.BASE_URL || "https://siamshoppinghub.com";
            const publicMediaUrl = mediaUrl.startsWith("http") 
              ? mediaUrl 
              : `${baseUrl}${mediaUrl}`;

            console.log("📱 WhatsApp: Creating status with media:", publicMediaUrl);

            // Step 1: Upload media to WhatsApp
            // For images/videos, we need to upload to WhatsApp's media endpoint first
            let mediaId: string;

            if (mediaType === "image") {
              // Upload image
              const uploadResponse = await axios.post(
                `https://graph.facebook.com/v22.0/${user.whatsappPhoneNumberId}/media`,
                null,
                {
                  params: {
                    messaging_product: "whatsapp",
                    type: "image",
                    access_token: user.whatsappToken,
                  },
                  data: {
                    url: publicMediaUrl,
                    caption: post.content || "",
                  },
                }
              );

              if (!uploadResponse.data?.id) {
                throw new Error(uploadResponse.data?.error?.message || "Failed to upload image to WhatsApp");
              }

              mediaId = uploadResponse.data.id;
            } else if (mediaType === "video") {
              // Upload video
              const uploadResponse = await axios.post(
                `https://graph.facebook.com/v22.0/${user.whatsappPhoneNumberId}/media`,
                null,
                {
                  params: {
                    messaging_product: "whatsapp",
                    type: "video",
                    access_token: user.whatsappToken,
                  },
                  data: {
                    url: publicMediaUrl,
                    caption: post.content || "",
                  },
                }
              );

              if (!uploadResponse.data?.id) {
                throw new Error(uploadResponse.data?.error?.message || "Failed to upload video to WhatsApp");
              }

              mediaId = uploadResponse.data.id;
            } else {
              errors.push({
                platform: "WhatsApp",
                error: "WhatsApp Status only supports images and videos.",
              });
              break;
            }

            // Step 2: Post status using the media ID
            // Note: WhatsApp Status API may require special permissions
            // For now, we'll use the message API to send as status
            const statusResponse = await axios.post(
              `https://graph.facebook.com/v22.0/${user.whatsappPhoneNumberId}/messages`,
              {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: (user.whatsappUserProfile as any)?.phoneNumber || "STATUS", // Status broadcast
                type: mediaType === "image" ? "image" : "video",
                [mediaType === "image" ? "image" : "video"]: {
                  id: mediaId,
                  caption: post.content || "",
                },
              },
              {
                headers: {
                  Authorization: `Bearer ${user.whatsappToken}`,
                  "Content-Type": "application/json",
                },
              }
            );

            if (!statusResponse.data?.messages?.[0]?.id) {
              throw new Error(statusResponse.data?.error?.message || "Failed to post WhatsApp status");
            }

            console.log("✅ WhatsApp: Status posted successfully:", statusResponse.data.messages[0].id);
          } catch (error) {
            if (axios.isAxiosError(error)) {
              const waError = error.response?.data?.error;
              console.error("❌ WhatsApp API Error:", waError || error.message);
              errors.push({
                platform: "WhatsApp",
                error: waError?.message || `WhatsApp API error: ${error.response?.statusText || error.message}`,
              });
            } else {
              console.error("❌ WhatsApp posting error:", error);
              errors.push({
                platform: "WhatsApp",
                error: error instanceof Error ? error.message : "Failed to post to WhatsApp",
              });
            }
          }
          break;

        case "youtube":
          // YouTube Data API v3 - Video Upload
          // Docs: https://developers.google.com/youtube/v3/guides/uploading_a_video
          if (!user.youtubeToken || !user.youtubeChannelId) {
            errors.push({
              platform: "YouTube",
              error: "YouTube not connected. Please connect your YouTube account.",
            });
            break;
          }

          try {
            // YouTube only supports video uploads (not text-only posts)
            if (mediaType !== "video") {
              errors.push({
                platform: "YouTube",
                error: "YouTube only supports video uploads. Please include a video file.",
              });
              break;
            }

            const mediaUrls = post.mediaUrls as string[];
            if (!mediaUrls || mediaUrls.length === 0) {
              errors.push({
                platform: "YouTube",
                error: "No video file provided for YouTube upload.",
              });
              break;
            }

            // Get the first video (YouTube uploads one video at a time)
            const videoUrl = mediaUrls[0];
            const videoPath = path.join(__dirname, "..", videoUrl);

            // Check if file exists
            try {
              await fsp.access(videoPath);
            } catch {
              errors.push({
                platform: "YouTube",
                error: `Video file not found: ${videoUrl}`,
              });
              break;
            }

            // Import googleapis and set up OAuth client
            const { google } = await import("googleapis");
            const oauth2Client = new google.auth.OAuth2(
              process.env.GOOGLE_CLIENT_ID,
              process.env.GOOGLE_CLIENT_SECRET,
              process.env.GOOGLE_REDIRECT_URI
            );

            // Set credentials (with refresh token if available)
            oauth2Client.setCredentials({
              access_token: user.youtubeToken,
              refresh_token: user.youtubeRefreshToken || undefined,
            });

            // Refresh token if needed
            if (user.youtubeRefreshToken) {
              try {
                const { credentials } = await oauth2Client.refreshAccessToken();
                if (credentials.access_token) {
                  // Update stored token if refreshed
                  await storage.updateUserYouTubeToken(
                    user.id,
                    credentials.access_token,
                    credentials.refresh_token || user.youtubeRefreshToken || "",
                    user.youtubeChannelId || "",
                    user.youtubeUserProfile as any
                  );
                  oauth2Client.setCredentials(credentials);
                }
              } catch (refreshError) {
                console.warn("⚠️ Failed to refresh YouTube token, using existing token");
              }
            }

            const youtube = google.youtube({ version: "v3", auth: oauth2Client });

            // Get video file size for logging
            const videoStats = await fsp.stat(videoPath);
            const videoSize = videoStats.size;

            console.log(`📹 YouTube: Uploading video (${(videoSize / 1024 / 1024).toFixed(2)} MB)`);

            // Prepare video metadata
            const videoMetadata = {
              snippet: {
                title: post.content.substring(0, 100) || "Untitled Video", // YouTube title max 100 chars
                description: post.content || "",
                tags: [], // Can be extended to parse tags from content
                categoryId: "22", // People & Blogs (default)
              },
              status: {
                privacyStatus: "private", // Default to private, can be made configurable
              },
            };

            // Create a readable stream from the video file
            // YouTube API requires a stream, not a Buffer
            const videoStream = fs.createReadStream(videoPath);
            
            // Detect mime type from file extension
            const ext = path.extname(videoPath).toLowerCase();
            const mimeTypes: Record<string, string> = {
              '.mp4': 'video/mp4',
              '.mov': 'video/quicktime',
              '.avi': 'video/x-msvideo',
              '.webm': 'video/webm',
              '.mkv': 'video/x-matroska',
            };
            const mimeType = mimeTypes[ext] || 'video/mp4';

            // Upload video using resumable upload
            const uploadResponse = await youtube.videos.insert({
              part: ["snippet", "status"],
              requestBody: videoMetadata,
              media: {
                body: videoStream,
                mimeType: mimeType,
              },
            });

            if (!uploadResponse.data.id) {
              throw new Error("Failed to upload video to YouTube");
            }

            const videoId = uploadResponse.data.id;
            console.log(`✅ YouTube: Video uploaded successfully: https://www.youtube.com/watch?v=${videoId}`);
          } catch (error) {
            if (axios.isAxiosError(error)) {
              const ytError = error.response?.data?.error;
              console.error("❌ YouTube API Error:", ytError || error.message);
              errors.push({
                platform: "YouTube",
                error: ytError?.message || `YouTube API error: ${error.response?.statusText || error.message}`,
              });
            } else {
              console.error("❌ YouTube posting error:", error);
              errors.push({
                platform: "YouTube",
                error: error instanceof Error ? error.message : "Failed to post to YouTube",
              });
            }
          }
          break;

        default:
          errors.push({
            platform,
            error: "Unsupported platform",
          });
          break;
      }
    } catch (platformError) {
      console.error(`Failed to post to ${platform}:`, platformError);
      await storage.updatePostStatus(post.id, `error_${platform}`);
      continue;
    }
  }

  // Only mark as published if there are no errors
  if (errors.length === 0) {
    if (Object.keys(platformRemoteIds).length > 0) {
      const prevIds =
        (post.analytics as { platformIds?: Record<string, string> } | undefined)?.platformIds || {};
      await storage.updatePost(post.id, {
        analytics: {
          ...post.analytics,
          platformIds: { ...prevIds, ...platformRemoteIds },
        },
      });
    }
    await storage.updatePostStatus(post.id, "published");
    console.log(`✅ Post ${post.id} published successfully to all platforms`);
  } else {
    // Mark as failed and log errors
    await storage.updatePostStatus(post.id, "failed");
    console.error(`❌ Post ${post.id} failed with errors:`, errors);
    // Throw error with details so caller can handle it
    throw new Error(`Failed to publish post: ${errors.map(e => `${e.platform}: ${e.error}`).join(", ")}`);
  }
};