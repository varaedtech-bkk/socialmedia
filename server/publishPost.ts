import axios from "axios";
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

  for (const platform of post.platforms) {
    try {
      switch (platform) {
        case "facebook-page":
          if (!user.facebookPageToken || !user.facebookPageId) {
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

          const fbPageEndpoint = `https://graph.facebook.com/v22.0/${user.facebookPageId}/feed`;
          let fbPageData: any = {
            message: post.content,
            access_token: user.facebookPageToken,
          };

          if (mediaType === "image" || mediaType === "video") {
            const mediaIds = await uploadMediaToPlatforms(
              user.facebookPageToken,
              user.facebookPageId,
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
            console.log(`✅ Successfully posted to Facebook Page: ${fbPageResponse.data.id}`);
          }
          break;

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
          const baseUrl = process.env.BASE_URL || "http://localhost:9002";
          
          // Instagram requires publicly accessible URLs
          // For local development, this won't work - need a public URL or CDN
          const publicMediaUrl = mediaUrl.startsWith("http") 
            ? mediaUrl 
            : `${baseUrl}${mediaUrl}`;

          console.log("📸 Instagram: Creating media container for:", publicMediaUrl);

          // Step 1: Create media container
          const createMediaParams: Record<string, string> = {
            access_token: user.instagramToken,
            caption: post.content || "",
          };

          if (mediaType === "image") {
            createMediaParams.image_url = publicMediaUrl;
          } else if (mediaType === "video") {
            createMediaParams.video_url = publicMediaUrl;
            createMediaParams.media_type = "REELS"; // or "VIDEO" for feed videos
          }

          const createMediaResponse = await axios.post(
            `https://graph.instagram.com/v22.0/${user.instagramBusinessAccountId}/media`,
            null,
            { params: createMediaParams }
          );

          const creationId = createMediaResponse.data.id;
          if (!creationId) {
            throw new Error(createMediaResponse.data.error?.message || "Failed to create Instagram media container");
          }

          console.log("📸 Instagram: Media container created:", creationId);

          // Step 2: For videos, wait for processing (check status)
          if (mediaType === "video") {
            let status = "IN_PROGRESS";
            let attempts = 0;
            const maxAttempts = 30; // Max 5 minutes (30 * 10 seconds)

            while (status === "IN_PROGRESS" && attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
              
              const statusResponse = await axios.get(
                `https://graph.instagram.com/v22.0/${creationId}`,
                {
                  params: {
                    fields: "status_code",
                    access_token: user.instagramToken,
                  },
                }
              );
              
              status = statusResponse.data.status_code;
              attempts++;
              console.log(`📸 Instagram: Video processing status: ${status} (attempt ${attempts})`);
            }

            if (status !== "FINISHED") {
              throw new Error(`Video processing failed with status: ${status}`);
            }
          }

          // Step 3: Publish the media
          const publishResponse = await axios.post(
            `https://graph.instagram.com/v22.0/${user.instagramBusinessAccountId}/media_publish`,
            null,
            {
              params: {
                creation_id: creationId,
                access_token: user.instagramToken,
              },
            }
          );

          const mediaId = publishResponse.data.id;
          if (!mediaId) {
            throw new Error(publishResponse.data.error?.message || "Failed to publish Instagram media");
          }

          console.log("✅ Instagram: Post published successfully:", mediaId);
        } catch (error) {
          if (axios.isAxiosError(error)) {
            const igError = error.response?.data?.error;
            console.error("❌ Instagram API Error:", igError || error.message);
            errors.push({
              platform: "Instagram",
              error: igError?.message || `Instagram API error: ${error.response?.statusText || error.message}`,
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
            const baseUrl = process.env.BASE_URL || "http://localhost:9002";
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