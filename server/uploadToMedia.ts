import path from "path";
import fs from "fs"; // Regular fs module for createReadStream
import FormData from "form-data"; // For handling multipart/form-data
import axios from "axios";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const uploadMediaToPlatforms = async (
  accessToken: string,
  targetId: string, // "me" for personal accounts, page ID for pages, or Instagram Business Account ID
  mediaUrls: string[],
  mediaType: "image" | "video",
  platform: "facebook" | "instagram" // Specify the platform
): Promise<Array<{ media_fbid: string }>> => {
  const mediaIds: Array<{ media_fbid: string }> = [];

  for (const mediaUrl of mediaUrls) {
    const filePath = path.join(__dirname, "..", mediaUrl);

    if (platform === "facebook") {
      // Handle Facebook media uploads
      const formData = new FormData();

      if (mediaType === "image") {
        // Upload image to Facebook
        formData.append("source", fs.createReadStream(filePath));
        formData.append("access_token", accessToken);
        formData.append("published", "false");

        const uploadResponse = await axios.post(
          `https://graph.facebook.com/v22.0/${targetId}/photos`,
          formData,
          {
            headers: {
              ...formData.getHeaders(),
            },
          }
        );

        if (!uploadResponse.data || uploadResponse.data.error) {
          throw new Error(
            uploadResponse.data.error?.message || "Facebook API error"
          );
        }

        mediaIds.push({ media_fbid: uploadResponse.data.id });
      } else if (mediaType === "video") {
        // Upload video to Facebook
        // Step 1: Initialize the video upload
        const initResponse = await axios.post(
          `https://graph.facebook.com/v22.0/${targetId}/videos`,
          {
            upload_phase: "start",
            access_token: accessToken,
            file_size: fs.statSync(filePath).size,
            published: false, // Set to false to upload without publishing immediately
          }
        );

        if (!initResponse.data || initResponse.data.error) {
          throw new Error(
            initResponse.data.error?.message ||
              "Failed to initialize Facebook video upload"
          );
        }

        const { upload_session_id, video_id } = initResponse.data;

        // Step 2: Transfer the video file
        const videoFormData = new FormData();
        videoFormData.append("source", fs.createReadStream(filePath));
        videoFormData.append("upload_session_id", upload_session_id);
        videoFormData.append("access_token", accessToken);

        try {
          const uploadResponse = await axios.post(
            `https://graph-video.facebook.com/v22.0/${upload_session_id}`,
            videoFormData,
            {
              headers: {
                ...videoFormData.getHeaders(),
                "Content-Length": fs.statSync(filePath).size, // Ensure the file size is included
              },
            }
          );

          if (!uploadResponse.data || uploadResponse.data.error) {
            throw new Error(
              uploadResponse.data.error?.message ||
                "Failed to upload video to Facebook"
            );
          }
        } catch (uploadError: unknown) {
          const error = uploadError as any; // Explicitly cast to `any`
          console.error(
            "Facebook video upload error:",
            error.response?.data || error.message
          );
          throw new Error("Failed to upload video to Facebook");
        }

        // Step 3: Finish the upload and publish the video
        const publishResponse = await axios.post(
          `https://graph.facebook.com/v22.0/${targetId}/videos`,
          {
            upload_phase: "finish",
            upload_session_id,
            access_token: accessToken,
            published: true, // Set to true to publish the video
          }
        );

        if (!publishResponse.data || publishResponse.data.error) {
          throw new Error(
            publishResponse.data.error?.message ||
              "Failed to publish video on Facebook"
          );
        }

        mediaIds.push({ media_fbid: video_id });
      }
    } else if (platform === "instagram") {
      // Handle Instagram media uploads
      // Instagram API requires a publicly accessible URL or direct file upload
      // For local files, we need to upload to a temporary public URL or use multipart upload
      
      const formData = new FormData();
      
      if (mediaType === "image") {
        // Upload image directly using multipart/form-data
        formData.append("image_file", fs.createReadStream(filePath));
        formData.append("access_token", accessToken);
        formData.append("caption", ""); // Caption will be added when publishing
        
        const uploadResponse = await axios.post(
          `https://graph.facebook.com/v22.0/${targetId}/media`,
          formData,
          {
            headers: {
              ...formData.getHeaders(),
            },
          }
        );

        if (!uploadResponse.data || uploadResponse.data.error) {
          throw new Error(
            uploadResponse.data.error?.message || "Instagram API error"
          );
        }

        mediaIds.push({ media_fbid: uploadResponse.data.id });
      } else if (mediaType === "video") {
        // Instagram video upload requires a publicly accessible URL
        // For local files, you need to upload to a CDN or use Instagram's video upload API
        // This is a simplified version - in production, upload to S3/CDN first
        
        // Option 1: If you have a public URL, use it
        // const videoUrl = `https://yourdomain.com${mediaUrl}`;
        
        // Option 2: Upload directly (requires file to be accessible via URL)
        // For now, we'll use the file path - but this requires the file to be publicly accessible
        const baseUrl = process.env.BASE_URL || "https://siamshoppinghub.com";
        const publicUrl = `${baseUrl}${mediaUrl.replace(/^\.\.\//, "")}`;
        
        const createMediaResponse = await axios.post(
          `https://graph.facebook.com/v22.0/${targetId}/media`,
          {
            access_token: accessToken,
            media_type: "REELS", // or "VIDEO" for regular posts
            video_url: publicUrl,
            caption: "", // Caption added when publishing
          }
        );

        if (!createMediaResponse.data || createMediaResponse.data.error) {
          throw new Error(
            createMediaResponse.data.error?.message || "Instagram API error"
          );
        }

        mediaIds.push({ media_fbid: createMediaResponse.data.id });
      }
    } else {
      throw new Error("Unsupported platform");
    }
  }

  return mediaIds;
};
