import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { z } from "zod";
import multer from "multer";
import path from "path";
import { getSubscription, createSubscription } from '../client/src/lib/types/subscription';
import { handleStripeWebhook } from '../client/src/lib/types/webhooks';

import bodyParser from 'body-parser';
import fsp from "fs/promises"; // fs/promises for other operations

import axios from "axios";
import express from "express";

import { initializeScheduledPosts, schedulePost } from "./schedulePost";
import { publishPost } from "./publishPost";
import { insertPostSchema } from "@shared/schema";
import { checkPostQuota } from "@/lib/postQuota";
import { checkPlatformRateLimit } from "@/lib/rateLimiter";
import { 
  isFeatureEnabled, 
  FEATURE_KEYS
} from "./feature-config";

/** Log errors with context for debugging; captures message, stack, and axios response when present */
function logError(context: string, error: unknown, extra?: Record<string, unknown>): void {
  const payload: Record<string, unknown> = {
    context,
    at: new Date().toISOString(),
    message: error instanceof Error ? error.message : String(error),
    ...extra,
  };
  if (error instanceof Error && error.stack) payload.stack = error.stack;
  if (axios.isAxiosError(error)) {
    payload.status = error.response?.status;
    payload.responseData = error.response?.data;
    payload.responseHeaders = error.response?.headers ? { "content-type": error.response.headers["content-type"] } : undefined;
  }
  console.error("[ERROR]", JSON.stringify(payload, null, 2));
}

const upload = multer({
  storage: multer.diskStorage({
    destination: "./uploads",
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(
        null,
        file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
      );
    },
  }),
});

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);
  // Reinitialize scheduled posts on server startup
  await initializeScheduledPosts();
  // app.use(cors({
  //   origin: process.env.CLIENT_URL,
  //   credentials: true
  // }));
  
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  // Make sure uploads directory exists
  await fsp.mkdir("./uploads", { recursive: true });

  app.get("/api/auth/:platform", async (req, res) => {
    const { platform } = req.params;

    try {
      const state = JSON.stringify({
        type: "page",
      });
      const stateLinkedin = JSON.stringify({
        type: platform === "linkedin" ? "personal" : "page",
      });

      let authUrl: string;

      if (platform === "youtube") {
        // YouTube Data API v3 via Google OAuth 2.0
        // Docs: https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps
        const { google } = await import("googleapis");
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_REDIRECT_URI
        );
        const scopes = [
          "https://www.googleapis.com/auth/youtube.upload",
          "https://www.googleapis.com/auth/youtube",
        ];
        authUrl = oauth2Client.generateAuthUrl({
          access_type: "offline",
          scope: scopes,
          prompt: "consent", // Force consent to get refresh token
        });
      } else {
        const getAuthUrl = (platform: string): string => {
          switch (platform) {
            case "facebook-page":
              return `https://www.facebook.com/v22.0/dialog/oauth?client_id=${
                process.env.META_PAGE_APP_ID
              }&redirect_uri=${
                process.env.META_REDIRECT_URI
              }&state=${encodeURIComponent(
                state
              )}&scope=pages_show_list,pages_manage_posts,pages_read_engagement`;

            case "linkedin":
              // Use profile+email+w_member_social (no openid – requires "Sign In with OpenID Connect" product)
              return `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${
                process.env.LINKEDIN_CLIENT_ID
              }&redirect_uri=${
                encodeURIComponent(process.env.LINKEDIN_REDIRECT_URI || "")
              }&scope=${encodeURIComponent("profile email w_member_social")}&state=${encodeURIComponent(
                stateLinkedin
              )}`;

            case "linkedin-page": {
              // Page-only app: request only scopes your app has (many apps only have r_organization_social; add w_organization_social in Developer Portal for posting)
              const pageClientId = process.env.LINKEDIN_PAGE_CLIENT_ID || process.env.LINKEDIN_CLIENT_ID;
              const pageRedirectUri = process.env.LINKEDIN_PAGE_REDIRECT_URI || process.env.LINKEDIN_REDIRECT_URI || "";
              if (!pageClientId) throw new Error("LinkedIn Page: set LINKEDIN_PAGE_CLIENT_ID or LINKEDIN_CLIENT_ID");
              return `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${
                pageClientId
              }&redirect_uri=${encodeURIComponent(pageRedirectUri)}&scope=${encodeURIComponent("r_organization_social")}&state=${encodeURIComponent(
                JSON.stringify({ type: "page" })
              )}`;
            }

            case "instagram": {
              // Instagram API with Instagram Login – redirect_uri must match Meta Console exactly
              const instagramRedirect = (process.env.INSTAGRAM_REDIRECT_URI || "").trim();
              if (!instagramRedirect) throw new Error("INSTAGRAM_REDIRECT_URI is not set");
              return `https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authentication=1&client_id=${
                process.env.INSTAGRAM_APP_ID
              }&redirect_uri=${encodeURIComponent(instagramRedirect)}&response_type=code&scope=instagram_business_basic,instagram_business_content_publish`;
            }

            case "whatsapp":
              // WhatsApp Business API via Meta Business
              // Requires WhatsApp product enabled in Facebook App
              // Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
              return `https://www.facebook.com/v22.0/dialog/oauth?client_id=${
                process.env.META_PAGE_APP_ID || process.env.WHATSAPP_APP_ID
              }&redirect_uri=${encodeURIComponent(
                process.env.WHATSAPP_REDIRECT_URI || process.env.META_REDIRECT_URI || ""
              )}&state=${encodeURIComponent(
                JSON.stringify({ type: "whatsapp" })
              )}&scope=whatsapp_business_management,whatsapp_business_messaging`;

            default:
              throw new Error("Unsupported platform");
          }
        };
        authUrl = getAuthUrl(platform);
      }

      res.json({ authUrl });
    } catch (error) {
      logError("Auth initiation", error, { platform: req.params.platform });
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get("/api/facebook/auth/callback", async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect("/auth");

    const { code, state } = req.query; // Get `state` and `code`
    console.log(state, "Raw state from Facebook");

    if (!code) {
      return res.redirect(`/?error=facebook_auth_failed&reason=no_code`);
    }

    try {
      // Facebook Page OAuth - exchange code for access token
      const clientId = process.env.META_PAGE_APP_ID;
      const clientSecret = process.env.META_PAGE_APP_SECRET;
      const redirectUri = process.env.META_REDIRECT_URI;

      const tokenResponse = await axios.get(
        `https://graph.facebook.com/v22.0/oauth/access_token`,
        {
          params: {
            client_id: clientId,
            redirect_uri: redirectUri,
            client_secret: clientSecret,
            code: code,
          },
        }
      );

      const { access_token: userAccessToken } = tokenResponse.data;

      if (!userAccessToken) {
        throw new Error(
          tokenResponse.data.error?.message ||
            "Failed to retrieve user access token"
        );
      }

      // Validate the token
      const validateResponse = await fetch(
        `https://graph.facebook.com/v22.0/debug_token?input_token=${userAccessToken}&access_token=${userAccessToken}`
      );
      const validateData = await validateResponse.json();
      console.log(validateData, 'validate')
      console.log(userAccessToken,'userAccessToken')
      if (!validateResponse.ok || !validateData.data?.is_valid) {
        throw new Error("Invalid access token received");
      }

      // Fetch user's pages
      const pagesResponse = await axios.get(
        `https://graph.facebook.com/v22.0/me/accounts`,
        {
          params: { access_token: userAccessToken },
        }
      );

      if (!pagesResponse.data || !pagesResponse.data.data.length) {
        throw new Error("No pages found for this user");
      }

      const page = pagesResponse.data.data[0]; // Taking the first page
      const pageAccessToken = page.access_token;
      const pageId = page.id;

      if (!pageAccessToken) {
        throw new Error("Failed to fetch Facebook pages");
      }

      // Store page token
      await storage.updateUserFacebookPageToken(
        req.user!.id,
        pageAccessToken,
        pageId
      );
      res.redirect(`/?facebook_page_connected=true`);
    } catch (error) {
      logError("Facebook OAuth callback", error, { userId: req.user?.id });
      res.redirect(`/?error=facebook_auth_failed&reason=api_error`);
    }
  });

  // LinkedIn callback route (handles both personal and page)
  app.get("/api/auth/linkedin/callback", async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect("/auth");
    const { code, state, error: oauthError, error_description: errorDesc } = req.query;

    if (oauthError) {
      logError("LinkedIn OAuth redirect (error from LinkedIn)", new Error(String(oauthError)), { oauthError, errorDesc, query: req.query });
      const reason = typeof errorDesc === "string" ? encodeURIComponent(errorDesc) : oauthError;
      return res.redirect(`/?error=linkedin_auth_failed&reason=${reason}`);
    }

    if (!code) {
      logError("LinkedIn callback missing code", new Error("no_code"), { query: req.query, userId: req.user?.id });
      const reason = typeof errorDesc === "string"
        ? encodeURIComponent(errorDesc)
        : "no_code";
      return res.redirect(`/?error=linkedin_auth_failed&reason=${reason}`);
    }

    try {
      // Parse state to determine if this is for personal or page
      let authType = "personal";
      if (state) {
        try {
          const parsedState = JSON.parse(decodeURIComponent(state as string));
          authType = parsedState.type === "page" ? "page" : "personal";
        } catch {
          authType = "personal";
        }
      }

      // Use Page app credentials when connecting a Page (optional separate app)
      const clientId = authType === "page"
        ? (process.env.LINKEDIN_PAGE_CLIENT_ID || process.env.LINKEDIN_CLIENT_ID)
        : process.env.LINKEDIN_CLIENT_ID;
      const clientSecret = authType === "page"
        ? (process.env.LINKEDIN_PAGE_CLIENT_SECRET || process.env.LINKEDIN_CLIENT_SECRET)
        : process.env.LINKEDIN_CLIENT_SECRET;
      const redirectUri = authType === "page"
        ? (process.env.LINKEDIN_PAGE_REDIRECT_URI || process.env.LINKEDIN_REDIRECT_URI)
        : process.env.LINKEDIN_REDIRECT_URI;

      if (!clientId || !clientSecret || !redirectUri) {
        throw new Error(authType === "page"
          ? "LinkedIn Page: set LINKEDIN_PAGE_CLIENT_ID, LINKEDIN_PAGE_CLIENT_SECRET (and optionally LINKEDIN_PAGE_REDIRECT_URI)"
          : "LinkedIn: set LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_REDIRECT_URI");
      }

      // Exchange authorization code for access token
      const tokenParams = new URLSearchParams({
        grant_type: "authorization_code",
        code: code as string,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      });

      const tokenResponse = await axios.post(
        "https://www.linkedin.com/oauth/v2/accessToken",
        tokenParams.toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      const accessToken = tokenResponse.data.access_token;
      if (!accessToken) {
        throw new Error("Failed to obtain access token");
      }

      if (authType === "page") {
        // LinkedIn Page: no profile scope on Page-only apps – go straight to organizations
        // Get user's organizations (LinkedIn Pages)
        let organizationsResponse;
        try {
          organizationsResponse = await axios.get(
            "https://api.linkedin.com/v2/organizationalEntityAcls",
            {
              params: {
                q: "roleAssignee",
                role: "ADMINISTRATOR",
              },
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );
        } catch (orgError) {
          if (axios.isAxiosError(orgError)) {
            const errorData = orgError.response?.data;
            logError("LinkedIn Organizations API", orgError, { userId: req.user?.id });
            
            // Check if it's a scope/permission error
            if (orgError.response?.status === 403 || orgError.response?.status === 401) {
              throw new Error(
                "LinkedIn Page access requires approval. Please:\n" +
                "1. Apply for 'w_organization_social' and 'r_organization_social' permissions in LinkedIn Developer Portal\n" +
                "2. Wait for LinkedIn's approval\n" +
                "3. Try connecting again after approval"
              );
            }
          }
          throw orgError;
        }

        const organizations = organizationsResponse.data?.elements;
        if (!organizations || organizations.length === 0) {
          throw new Error(
            "No LinkedIn Pages found. Please:\n" +
            "1. Make sure you have admin access to at least one LinkedIn Page\n" +
            "2. Verify your LinkedIn account has the necessary permissions"
          );
        }

        // Use the first organization/page
        const organization = organizations[0];
        const pageUrn = organization.organizationalTarget;

        if (!pageUrn) {
          throw new Error("Failed to retrieve LinkedIn Page URN");
        }

        console.log("✅ LinkedIn Page found:", pageUrn);

        // Store the LinkedIn Page token and URN
        await storage.updateUserLinkedInPageToken(
          req.user!.id,
          accessToken,
          pageUrn
        );

        res.redirect(`/?linkedin_page_connected=true`);
      } else {
        // LinkedIn Personal: needs profile scope (Sign In with LinkedIn product)
        const getLinkedInProfile = async (): Promise<{ sub: string; [k: string]: unknown }> => {
          try {
            const r = await axios.get("https://api.linkedin.com/v2/userinfo", {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (r.data?.sub) return r.data as { sub: string; [k: string]: unknown };
          } catch {
            // Fallback when app doesn't have OpenID Connect product
          }
          const me = await axios.get("https://api.linkedin.com/v2/me", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const id = me.data?.id;
          if (!id) throw new Error("Failed to retrieve LinkedIn profile");
          return { sub: String(id), ...me.data };
        };
        const userProfile = await getLinkedInProfile();
        if (!userProfile?.sub) throw new Error("Failed to retrieve user profile");
        await storage.updateUserLinkedInToken(
          req.user!.id,
          accessToken,
          userProfile
        );
        res.redirect(`/?linkedin_connected=true`);
      }
    } catch (error) {
      logError("LinkedIn OAuth callback", error, { userId: req.user?.id, state: req.query?.state });
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data as { error_description?: string; error?: string } | undefined;
        if (error.response?.status === 400) {
          const errorMessage = errorData?.error_description || errorData?.error || error.message;
          return res.redirect(`/?error=linkedin_auth_failed&reason=${encodeURIComponent(errorMessage)}`);
        }
      }
      const errorMessage = (error as Error).message || "api_error";
      res.redirect(`/?error=linkedin_auth_failed&reason=${encodeURIComponent(errorMessage)}`);
    }
  });

  // Instagram callback route (Instagram API with Instagram Login)
  // Docs: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/
  app.get("/api/auth/instagram/callback", async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect("/auth");
    const { code, error: oauthError, error_reason } = req.query;

    if (oauthError) {
      logError("Instagram OAuth redirect (error from Instagram)", new Error(String(oauthError)), { oauthError, error_reason, query: req.query });
      return res.redirect(`/?error=instagram_auth_failed&reason=${error_reason || "user_denied"}`);
    }

    if (!code) {
      return res.redirect(`/?error=instagram_auth_failed&reason=no_code`);
    }

    try {
      const redirectUri = (process.env.INSTAGRAM_REDIRECT_URI || "").trim();
      if (!redirectUri) throw new Error("INSTAGRAM_REDIRECT_URI is not set");

      // Step 1: Exchange authorization code for short-lived access token (redirect_uri must match authorize request exactly)
      const tokenParams = new URLSearchParams({
        client_id: process.env.INSTAGRAM_APP_ID!,
        client_secret: process.env.INSTAGRAM_APP_SECRET!,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code: code as string,
      });

      const tokenResponse = await axios.post(
        "https://api.instagram.com/oauth/access_token",
        tokenParams.toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      const { access_token: shortLivedToken, user_id: instagramUserId } = tokenResponse.data;

      if (!shortLivedToken || !instagramUserId) {
        throw new Error("Failed to retrieve Instagram access token");
      }

      console.log("✅ Instagram short-lived token obtained for user:", instagramUserId);

      // Step 2: Exchange short-lived token for long-lived token (60 days)
      const longLivedTokenResponse = await axios.get(
        "https://graph.instagram.com/access_token",
        {
          params: {
            grant_type: "ig_exchange_token",
            client_secret: process.env.INSTAGRAM_APP_SECRET,
            access_token: shortLivedToken,
          },
        }
      );

      const longLivedToken = longLivedTokenResponse.data.access_token;
      const expiresIn = longLivedTokenResponse.data.expires_in; // Usually 5184000 seconds (60 days)

      console.log("✅ Instagram long-lived token obtained, expires in:", expiresIn, "seconds");

      // Step 3: Get user profile information
      const profileResponse = await axios.get(
        `https://graph.instagram.com/v22.0/me`,
        {
          params: {
            fields: "user_id,username,account_type,media_count",
            access_token: longLivedToken,
          },
        }
      );

      const userProfile = profileResponse.data;
      console.log("✅ Instagram profile retrieved:", userProfile.username);

      // Store the Instagram token and profile
      await storage.updateUserInstagramToken(
        req.user!.id,
        longLivedToken,
        userProfile,
        instagramUserId.toString()
      );

      res.redirect(`/app?instagram_connected=true`);
    } catch (error) {
      logError("Instagram OAuth callback", error, { userId: req.user?.id });
      res.redirect(`/app?error=instagram_auth_failed&reason=api_error`);
    }
  });

  // WhatsApp callback route (WhatsApp Business API via Meta Business)
  // Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
  app.get("/api/auth/whatsapp/callback", async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect("/auth");
    const { code, error: oauthError, state } = req.query;

    if (oauthError) {
      logError("WhatsApp OAuth redirect (error from Meta)", new Error(String(oauthError)), { oauthError, query: req.query });
      return res.redirect(`/?error=whatsapp_auth_failed&reason=${oauthError}`);
    }

    if (!code) {
      return res.redirect(`/?error=whatsapp_auth_failed&reason=no_code`);
    }

    try {
      // Parse state to verify it's for WhatsApp
      const parsedState = state ? JSON.parse(decodeURIComponent(state as string)) : {};
      if (parsedState.type !== "whatsapp") {
        throw new Error("Invalid state for WhatsApp");
      }

      // Exchange code for access token
      const clientId = process.env.META_PAGE_APP_ID || process.env.WHATSAPP_APP_ID;
      const clientSecret = process.env.META_PAGE_APP_SECRET || process.env.WHATSAPP_APP_SECRET;
      const redirectUri = process.env.WHATSAPP_REDIRECT_URI || process.env.META_REDIRECT_URI;

      const tokenResponse = await axios.get(
        `https://graph.facebook.com/v22.0/oauth/access_token`,
        {
          params: {
            client_id: clientId,
            redirect_uri: redirectUri,
            client_secret: clientSecret,
            code: code,
          },
        }
      );

      const { access_token: accessToken } = tokenResponse.data;

      if (!accessToken) {
        throw new Error("Failed to retrieve WhatsApp access token");
      }

      console.log("✅ WhatsApp access token obtained");

      // Get WhatsApp Business Account ID
      // First, get the business account associated with this token
      let businessAccountsResponse;
      try {
        businessAccountsResponse = await axios.get(
          `https://graph.facebook.com/v22.0/me/businesses`,
          {
            params: {
              access_token: accessToken,
            },
          }
        );
      } catch (error) {
        if (axios.isAxiosError(error)) {
          logError("WhatsApp fetch businesses", error, { userId: req.user?.id });
          throw new Error(
            `Failed to fetch business accounts: ${error.response?.data?.error?.message || error.message}. ` +
            `Make sure your app has 'whatsapp_business_management' permission.`
          );
        }
        throw error;
      }

      if (!businessAccountsResponse.data?.data?.length) {
        console.error("No businesses found. Response:", JSON.stringify(businessAccountsResponse.data, null, 2));
        throw new Error(
          "No Business Account found. Please:\n" +
          "1. Go to Meta Business Suite (https://business.facebook.com/)\n" +
          "2. Create or select a Business Account\n" +
          "3. Link your Facebook App to the Business Account"
        );
      }

      const businessId = businessAccountsResponse.data.data[0].id;
      console.log("✅ Business Account found:", businessId);

      // Get WhatsApp Business Account details
      let whatsappAccountsResponse;
      try {
        whatsappAccountsResponse = await axios.get(
          `https://graph.facebook.com/v22.0/${businessId}/owned_whatsapp_business_accounts`,
          {
            params: {
              access_token: accessToken,
              fields: "id,name,message_templates",
            },
          }
        );
      } catch (error) {
        if (axios.isAxiosError(error)) {
          logError("WhatsApp fetch WhatsApp accounts", error, { userId: req.user?.id, businessId });
          throw new Error(
            `Failed to fetch WhatsApp Business Accounts: ${error.response?.data?.error?.message || error.message}. ` +
            `Make sure WhatsApp product is enabled in your Facebook App.`
          );
        }
        throw error;
      }

      if (!whatsappAccountsResponse.data?.data?.length) {
        console.error("No WhatsApp accounts found. Response:", JSON.stringify(whatsappAccountsResponse.data, null, 2));
        throw new Error(
          "No WhatsApp Business Account found. Please:\n" +
          "1. Go to Meta Business Suite (https://business.facebook.com/)\n" +
          "2. Navigate to Settings → Business Assets → WhatsApp Accounts\n" +
          "3. Create a WhatsApp Business Account\n" +
          "4. Link it to your Business Account\n" +
          "5. Make sure your Facebook App has WhatsApp product enabled"
        );
      }

      const whatsappBusinessAccount = whatsappAccountsResponse.data.data[0];
      const whatsappBusinessAccountId = whatsappBusinessAccount.id;

      // Get Phone Number ID (required for sending messages/status)
      let phoneNumbersResponse;
      try {
        phoneNumbersResponse = await axios.get(
          `https://graph.facebook.com/v22.0/${whatsappBusinessAccountId}/phone_numbers`,
          {
            params: {
              access_token: accessToken,
              fields: "id,display_phone_number,verified_name",
            },
          }
        );
      } catch (error) {
        if (axios.isAxiosError(error)) {
          logError("WhatsApp fetch phone numbers", error, { userId: req.user?.id, whatsappBusinessAccountId });
          throw new Error(
            `Failed to fetch phone numbers: ${error.response?.data?.error?.message || error.message}`
          );
        }
        throw error;
      }

      const phoneNumberId = phoneNumbersResponse.data?.data?.[0]?.id;

      if (!phoneNumberId) {
        console.error("No phone numbers found. Response:", JSON.stringify(phoneNumbersResponse.data, null, 2));
        throw new Error(
          "No phone number found for WhatsApp Business Account. Please:\n" +
          "1. Go to Meta Business Suite (https://business.facebook.com/)\n" +
          "2. Navigate to your WhatsApp Business Account\n" +
          "3. Go to Phone Numbers section\n" +
          "4. Add and verify a phone number"
        );
      }

      console.log("✅ WhatsApp Business Account found:", whatsappBusinessAccountId);
      console.log("✅ Phone Number ID:", phoneNumberId);

      // Store WhatsApp token and account info
      await storage.updateUserWhatsAppToken(
        req.user!.id,
        accessToken,
        whatsappBusinessAccountId,
        phoneNumberId,
        {
          businessAccountId: businessId,
          businessAccountName: whatsappBusinessAccount.name,
          phoneNumber: phoneNumbersResponse.data.data[0].display_phone_number,
          verifiedName: phoneNumbersResponse.data.data[0].verified_name,
        }
      );

      res.redirect(`/?whatsapp_connected=true`);
    } catch (error) {
      logError("WhatsApp OAuth callback", error, { userId: req.user?.id });
      res.redirect(`/?error=whatsapp_auth_failed&reason=api_error`);
    }
  });

  // YouTube OAuth callback route
  app.get("/api/auth/callback/google", async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect("/auth");
    const { code, error } = req.query;

    if (error) {
      logError("YouTube OAuth redirect (error from Google)", new Error(String(error)), { error, query: req.query });
      return res.redirect(`/?error=youtube_auth_failed&reason=${error}`);
    }

    if (!code) {
      return res.redirect(`/?error=youtube_auth_failed&reason=no_code`);
    }

    try {
      const { google } = await import("googleapis");
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      // Exchange authorization code for tokens
      const { tokens } = await oauth2Client.getToken(code as string);
      
      if (!tokens.access_token) {
        throw new Error("Failed to retrieve YouTube access token");
      }

      if (!tokens.refresh_token) {
        console.warn("⚠️ No refresh token received. User may need to re-authenticate.");
      }

      console.log("✅ YouTube access token obtained");

      // Set credentials to get user info
      oauth2Client.setCredentials(tokens);

      // Get YouTube channel information
      const youtube = google.youtube({ version: "v3", auth: oauth2Client });
      const channelResponse = await youtube.channels.list({
        part: ["snippet", "contentDetails"],
        mine: true,
      });

      if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
        throw new Error("No YouTube channel found for this account");
      }

      const channel = channelResponse.data.items[0];
      const channelId = channel.id!;
      const channelInfo = {
        id: channelId,
        title: channel.snippet?.title,
        description: channel.snippet?.description,
        customUrl: channel.snippet?.customUrl,
        thumbnail: channel.snippet?.thumbnails?.default?.url,
      };

      console.log("✅ YouTube channel found:", channelId);

      // Store YouTube token and channel info
      await storage.updateUserYouTubeToken(
        req.user!.id,
        tokens.access_token,
        tokens.refresh_token || "",
        channelId,
        channelInfo
      );

      res.redirect(`/?youtube_connected=true`);
    } catch (error) {
      logError("YouTube OAuth callback", error, { userId: req.user?.id });
      res.redirect(`/?error=youtube_auth_failed&reason=api_error`);
    }
  });

  // Subscription routes (only if feature is enabled)
  app.post('/api/subscription', async (req, res) => {
    if (!isFeatureEnabled(FEATURE_KEYS.SUBSCRIPTIONS_ENABLED)) {
      return res.status(403).json({ 
        error: "Subscriptions are currently disabled",
        featureDisabled: true 
      });
    }
    // Check Stripe payments if subscription requires payment
    if (!isFeatureEnabled(FEATURE_KEYS.STRIPE_PAYMENTS_ENABLED)) {
      return res.status(403).json({ 
        error: "Payment processing is currently disabled",
        featureDisabled: true 
      });
    }
    return createSubscription(req, res);
  });
  
  app.post('/api/webhooks/stripe', 
    bodyParser.raw({ type: 'application/json' }),
    async (req, res) => {
      if (!isFeatureEnabled(FEATURE_KEYS.STRIPE_PAYMENTS_ENABLED)) {
        return res.status(403).json({ 
          error: "Payment processing is currently disabled",
          featureDisabled: true 
        });
      }
      return handleStripeWebhook(req, res);
    }
  );

  app.post("/api/posts",checkPostQuota, // Add this middleware
    upload.array("media"), 
    async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
  
    try {
      const files = req.files as Express.Multer.File[];
      const user = req.user!;
  
      const { content, platforms, mediaType, scheduledTime, timezone } = req.body;
  
      // Log the received scheduledTime and timezone
      console.log("Received scheduledTime (raw):", scheduledTime);
      console.log("Received timezone:", timezone);
  
      // Convert local time to UTC
      let utcScheduledTime: Date | null = null;
      if (scheduledTime) {
        const localTime = new Date(scheduledTime);
        utcScheduledTime = new Date(
          localTime.toLocaleString("en-US", { timeZone: timezone })
        );
        console.log(
          "Converted scheduledTime (UTC):",
          utcScheduledTime.toISOString()
        );
      }
  
      // Parse and validate platforms
      const parsedPlatforms = JSON.parse(platforms);
      const validatedPlatforms = insertPostSchema.shape.platforms.parse(parsedPlatforms);
  console.log(validatedPlatforms,'validate')
      const mediaUrls = files.map((file) => `/uploads/${file.filename}`);
      
       // Check platform rate limits before scheduling
    for (const platform of validatedPlatforms) {
      const allowed = await checkPlatformRateLimit(user.id, platform);
      if (!allowed) {
        throw new Error(`Rate limit exceeded for ${platform}`);
      }
    }


      // Create the post with UTC scheduledTime
      const post = await storage.createPost(user.id, {
        content: content as string,
        scheduledTime: utcScheduledTime as Date | null,
        platforms: validatedPlatforms, // Use the validated platforms
        mediaUrls: mediaUrls as string[],
        mediaType: mediaType as "text" | "image" | "video" | "pdf",
        timezone: "UTC" as string,
        status: utcScheduledTime ? "scheduled" : "draft",
        analytics: {
          impressions: 0,
          clicks: 0,
          likes: 0,
          shares: 0,
          comments: 0,
        },
      });
  
      // If the post is scheduled, create a cron job
      if (utcScheduledTime) {
        schedulePost(post.id, utcScheduledTime, timezone);
      } else {
        // If the post is not scheduled, publish it immediately
        await publishPost(post.id);
      }
  
      res.json(post);
    } catch (err) {
      if (req.files) {
        const files = req.files as Express.Multer.File[];
        await Promise.all(
          files.map((file) => fsp.unlink(file.path).catch((e) => logError("Post creation cleanup (unlink)", e, { path: file.path })))
        );
      }
      logError("Post creation", err, { userId: req.user?.id, body: { platforms: req.body?.platforms, mediaType: req.body?.mediaType } });
      res.status(400).json({ error: (err as Error).message });
    }
  });
  app.get("/api/posts", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const posts = await storage.getUserPosts(req.user!.id);
      res.json(posts);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.patch("/api/posts/:id/status", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { status } = z.object({ status: z.string() }).parse(req.body);
      const post = await storage.updatePostStatus(
        parseInt(req.params.id),
        status
      );
      res.json(post);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.delete("/api/posts/:postId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const postId = parseInt(req.params.postId, 10);
      console.log("Deleting post with ID:", postId);

      const deletedPost = await storage.deletePost(postId);
      console.log("Successfully deleted post:", deletedPost);

      if (!deletedPost) {
        throw new Error(
          "Failed to delete post: Post not found or already deleted"
        );
      }

      res.status(200).json(deletedPost); // Return the deleted post as JSON
    } catch (err) {
      logError("Delete post", err, { postId: req.params.postId, userId: req.user?.id });
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.get('/api/subscription', async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    // If subscriptions are disabled, return unlimited/default values
    if (!isFeatureEnabled(FEATURE_KEYS.SUBSCRIPTIONS_ENABLED)) {
      return res.json({
        plan: 'free',
        status: 'active',
        current_period_end: 0,
        posts_used: 0,
        posts_limit: Infinity, // Unlimited when feature is disabled
        featureDisabled: true,
      });
    }
    
    try {
      const subscription = await storage.getUserSubscription(req.user!.id);
      res.json({
        plan: subscription?.plan || 'free',
        status: subscription?.status || 'inactive',
        current_period_end: subscription?.periodEnd || 0,
        posts_used: subscription?.postsUsed || 0,
        posts_limit: subscription?.postsLimit || 5, // Default free tier limit
      });
    } catch (error) {
      logError("Subscription fetch", error, { userId: req.user?.id });
      res.status(500).json({ error: 'Failed to fetch subscription' });
    }
  });

  // Register admin routes
  const { registerAdminRoutes } = await import("./routes-admin");
  registerAdminRoutes(app);

  app.use("/uploads", express.static("uploads"));

  const httpServer = createServer(app);
  return httpServer;
}
