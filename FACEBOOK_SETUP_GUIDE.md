# Meta Platforms Setup Guide (Facebook, Instagram, WhatsApp)

## Overview of Meta Platforms

### Currently Implemented:
- ✅ **Facebook Pages** - Fully working
- ✅ **Instagram Business** - Implemented (direct Instagram OAuth)
- ✅ **WhatsApp Business** - Implemented (Status posting)
- ❌ **Messenger** - Not yet implemented
- ❌ **Threads** - Not yet implemented

> **Note**: Facebook Personal profile posting has been removed as Facebook no longer allows third-party apps to post to personal profiles via API.

## Facebook Pages Setup

**Facebook Pages work reliably** and don't require app review for basic posting.

#### Steps to Configure Facebook Page App:

1. **Go to Facebook Developers Console**
   - Visit: https://developers.facebook.com/
   - Select your app (App ID: `523605123538703` for pages)

2. **Add Required Permissions**
   - Go to **App Dashboard** → **Products** → **Facebook Login** → **Settings**
   - Under **Valid OAuth Redirect URIs**, ensure your redirect URI is added:
     ```
     https://siamshoppinghub.com/api/facebook/auth/callback
     ```
   - For production, add your production URL too

3. **Add Page Permissions**
   - Go to **App Dashboard** → **Products** → **Add Product**
   - Add **Facebook Login** if not already added
   - Go to **App Review** → **Permissions and Features**
   - Request these permissions:
     - `pages_show_list` (Basic - usually auto-approved)
     - `pages_read_engagement` (Standard - may need review)
     - `pages_manage_posts` (Advanced - requires app review)

4. **Configure App Settings**
   - Go to **Settings** → **Basic**
   - Add your **App Domains** and **Site URL**
   - Add **Privacy Policy URL** (required for app review)

5. **Test with Test Users**
   - Go to **Roles** → **Test Users**
   - Create test users to test without app review
   - Add test users as admins of test pages

6. **Submit for App Review (if needed)**
   - Go to **App Review** → **Permissions and Features**
   - Click **Request** for `pages_manage_posts`
   - Provide:
     - Use case description
     - Step-by-step instructions
     - Video demonstration
     - Privacy policy URL

### Option 2: Personal Profile Posting (Not Recommended) ⚠️

**Facebook has deprecated posting to personal profiles.** The `user_posts` permission is limited and may not work.

If you absolutely need personal profile posting:

1. **Request Advanced Permissions**
   - Go to **App Review** → **Permissions and Features**
   - Request: `publish_actions` (if still available)
   - Note: This permission is deprecated and Facebook may reject it

2. **Submit Detailed App Review**
   - Explain why you need personal profile posting
   - Provide detailed use case
   - Show how it benefits users
   - Note: Facebook rarely approves this for third-party apps

3. **Alternative: Use Facebook Share Dialog**
   - Instead of API posting, use Facebook's Share Dialog
   - This doesn't require special permissions
   - Users share content themselves

## Current Configuration Check

### For Facebook Page App (ID: 523605123538703)

**Required Permissions:**
```
pages_show_list
pages_read_engagement  
pages_manage_posts
```

**Current OAuth Scope in Code:**
```javascript
scope=pages_show_list,pages_manage_posts,pages_read_engagement
```

✅ This is correct for Page posting.

## Step-by-Step Setup for Page Posting

### 1. Verify App Status
- Go to: https://developers.facebook.com/apps/523605123538703/dashboard/
- Check **App Mode**: Development or Live
- Development mode: Only works for app admins/developers/test users
- Live mode: Works for all users (requires app review)

### 2. Add Permissions
1. Navigate to: **App Dashboard** → **Products** → **Facebook Login**
2. Click **Settings**
3. Scroll to **Permissions and Features**
4. Ensure these are added:
   - `pages_show_list` ✅
   - `pages_read_engagement` ⚠️ (may need review)
   - `pages_manage_posts` ⚠️ (requires review)

### 3. Configure OAuth Redirect URI
1. In **Facebook Login** → **Settings**
2. Under **Valid OAuth Redirect URIs**, add:
   ```
   https://siamshoppinghub.com/api/facebook/auth/callback
   https://yourdomain.com/api/facebook/auth/callback
   ```

### 4. Test in Development Mode
- Add yourself as **Admin** or **Developer** in **Roles**
- Create a test Facebook Page
- Make yourself admin of the test page
- Test the connection

### 5. Submit for App Review (for Live Mode)
1. Go to **App Review** → **Permissions and Features**
2. Find `pages_manage_posts`
3. Click **Request**
4. Fill out:
   - **What does your app do?** - Describe your social media management tool
   - **How will you use this permission?** - Explain posting to pages
   - **Step-by-step instructions** - Provide screenshots/video
   - **Privacy Policy URL** - Required

### 6. Verify Token Permissions
After connecting, check the token has the right permissions:
```javascript
GET https://graph.facebook.com/v22.0/me/permissions?access_token=YOUR_TOKEN
```

Should return:
```json
{
  "data": [
    {"permission": "pages_show_list", "status": "granted"},
    {"permission": "pages_read_engagement", "status": "granted"},
    {"permission": "pages_manage_posts", "status": "granted"}
  ]
}
```

## Troubleshooting

### Error: "Insufficient Scope"
- **Cause**: Token doesn't have required permissions
- **Fix**: Re-authenticate with correct scopes, or submit app for review

### Error: "App not installed on page"
- **Cause**: User isn't admin of the page, or app isn't added to page
- **Fix**: Make user admin of page, or install app on page

### Error: "Invalid OAuth access token"
- **Cause**: Token expired or invalid
- **Fix**: Re-authenticate to get new token

### Error: "Requires app review"
- **Cause**: App is in Live mode but permissions not approved
- **Fix**: Submit app for review, or switch to Development mode for testing

## Recommended Approach

**Use Facebook Pages instead of Personal Profiles:**
- ✅ More reliable
- ✅ Better API support
- ✅ Easier to get approved
- ✅ Professional use case
- ✅ Better for businesses

## Environment Variables

Make sure these are set correctly:

```env
# For Facebook Pages
META_PAGE_APP_ID='523605123538703'
META_PAGE_APP_SECRET='your_secret'
META_REDIRECT_URI='https://siamshoppinghub.com/api/facebook/auth/callback'
```

## Additional Resources

- Facebook Graph API Docs: https://developers.facebook.com/docs/graph-api
- Page Permissions: https://developers.facebook.com/docs/permissions/reference#pages
- App Review Guide: https://developers.facebook.com/docs/app-review
- Debug Token Tool: https://developers.facebook.com/tools/debug/accesstoken/


---

## Instagram Business Setup (Instagram API with Instagram Login)

### How Instagram Works in This App

This app uses **Instagram API with Instagram Login** – users sign in **directly with Instagram** at `instagram.com/oauth/authorize`. No Facebook Page link is required.

**Reference**: [Instagram API with Instagram Login Documentation](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/)

### Two Instagram options in Meta (use the right one)

Meta offers two different ways to connect Instagram:

| Option | What it is | Used by this app? |
|--------|------------|--------------------|
| **Instagram API with Facebook Login** | User connects Instagram to a **Facebook Page**, then authorizes your app via **Facebook Login for business**. Setup mentions “Set up Facebook login for business”, “Complete app review”, “Configure webhooks”. | **No.** |
| **Instagram API with Instagram Login** | User signs in **directly with Instagram** (no Facebook Page). Setup includes “Generate access tokens”, “Set up **Instagram business login**” (where you add the OAuth redirect URI). | **Yes.** |

If you see **“API Setup with Facebook login”** or **“Set up Facebook login for business”**, that’s the **Facebook Login** path. For MultiSocial Studio you need the **Instagram Login** path instead:

- In your app go to **Products → Instagram**.
- Look for **“Set up Instagram business login”** (or similar) and complete that flow.
- There you add **Valid OAuth Redirect URIs** (e.g. `https://siamshoppinghub.com/api/auth/instagram/callback`).
- You do **not** need to complete “Set up Facebook login for business” or “Complete app review” for basic connect-and-post with test users.

### Prerequisites

1. **Instagram Business or Creator Account**
   - Convert your Instagram account to Business or Creator account
   - Go to Instagram → Settings → Account → Switch to Professional Account
   - Choose "Business" or "Creator" account type

2. **Facebook Developer App with Instagram Product**
   - Create or use an existing Facebook App
   - Add the "Instagram" product to your app

### Meta Instagram product screen (what you see)

In **Products → Instagram** you’ll see three steps. Here’s what each means for MultiSocial Studio:

| Step in Meta | What to do for this app |
|--------------|--------------------------|
| **1. Generate access tokens** | Required. Add your Instagram account and assign yourself the **Instagram Tester** role in **Roles → Roles**. That lets you complete the “Connect Instagram” flow and get tokens. No need to “generate” tokens manually in the dashboard; our app gets them via OAuth when the user connects. |
| **2. Configure webhooks** | **Optional** for posting. This app does not use Instagram webhooks for connect or publish. You can leave Callback URL empty, or add a placeholder (e.g. `https://yourdomain.com/webhooks/instagram`) if the UI requires something. Webhooks are only needed for real-time comments/messages. |
| **3. Set up Instagram business login** | **Required.** This is where you add the **Valid OAuth Redirect URIs**. Click into this step and add exactly: `https://siamshoppinghub.com/api/auth/instagram/callback` (and your production URL when you deploy). Without this, you get “Invalid redirect_uri”. |

After step 3, save, then try **Connect Instagram** again in the app.

### Step-by-Step Setup

#### 1. Create/Configure Facebook App for Instagram

1. **Go to Facebook Developers Console**
   - Visit: https://developers.facebook.com/apps/
   - Create a new app or select existing one

2. **Add Instagram Product**
   - Go to **App Dashboard** → **Products** → **Add Product**
   - Find **Instagram** and click **Set Up**

3. **Configure Instagram Basic Display**
   - Go to **Products** → **Instagram** → **Settings**
   - Add **Instagram App ID** and **Instagram App Secret**
   - These are different from your Facebook App credentials!

4. **Configure OAuth Redirect URIs – localhost not allowed**
   - **Instagram Business Login does not accept `http://localhost`.** If you add `https://siamshoppinghub.com/...`, Meta will show: *"Error saving redirect URIs. Verify your redirect URIs and try again."*
   - You must use a **public HTTPS URL**. Two options:
     - **Option A – Local dev with a tunnel (recommended):** Use [ngrok](https://ngrok.com/) (or similar). Run `ngrok http 9002`, then in Meta add the URL ngrok gives you, e.g. `https://abc123.ngrok-free.app/api/auth/instagram/callback`. Set the same value in `.env` as `INSTAGRAM_REDIRECT_URI` and restart your server. See **"Local development with ngrok"** below.
     - **Option B – Deployed app:** Add your real app URL, e.g. `https://yourdomain.com/api/auth/instagram/callback`, and set that in `.env`.
   - In your app go to **Products** → **Instagram** → **Set up Instagram business login** → add the chosen URL under **Redirect URL** / **Valid OAuth Redirect URIs** (no trailing slash). Save.

5. **Add Test Users (Development Mode)**
   - Go to **Roles** → **Instagram Testers**
   - Add your Instagram account as a tester
   - Accept the tester invitation in Instagram app: Settings → Apps and Websites → Tester Invites

#### 2. Request Required Permissions

In **App Review** → **Permissions and Features**, request:

| Permission | Purpose | App Review Required |
|------------|---------|---------------------|
| `instagram_business_basic` | Read profile, media | No (testers only) |
| `instagram_business_content_publish` | Publish posts | Yes (for public apps) |
| `instagram_business_manage_comments` | Manage comments | Yes (optional) |
| `instagram_business_manage_messages` | Direct messages | Yes (optional) |

**Note**: As of January 27, 2025, the new scope values (`instagram_business_*`) replaced the old ones (`business_*`).

#### 3. Local development with ngrok (required – Meta does not allow localhost)

Because Instagram Business Login rejects `localhost` redirect URIs:

1. **Install ngrok** (e.g. `brew install ngrok` or from [ngrok.com](https://ngrok.com/)).
2. **Start your app** on port 9002 (e.g. `yarn dev`).
3. **Start the tunnel:**  
   `ngrok http 9002`  
   You’ll get a URL like `https://abc123.ngrok-free.app`.
4. **In Meta:** **Products** → **Instagram** → **Set up Instagram business login** → **Redirect URL**, add:  
   `https://YOUR_NGROK_SUBDOMAIN.ngrok-free.app/api/auth/instagram/callback`  
   (replace with your actual ngrok URL). Save.
5. **In `.env`** set the same URL:
   ```bash
   INSTAGRAM_REDIRECT_URI='https://YOUR_NGROK_SUBDOMAIN.ngrok-free.app/api/auth/instagram/callback'
   ```
6. **Restart your server.** Open your app in the browser via the **ngrok URL** (e.g. `https://abc123.ngrok-free.app`), then use **Connect Instagram**. The callback will work because the redirect URI is now a valid public URL.
7. **Note:** Free ngrok URLs change each time you restart ngrok. When they change, update the redirect URI in Meta and in `.env`, then restart the server.

#### 4. Configure Environment Variables

Add to your `.env` file (use your ngrok or production URL for redirect – not localhost):

```bash
# Instagram API with Instagram Login (redirect must be HTTPS and not localhost)
INSTAGRAM_APP_ID='your_instagram_app_id'
INSTAGRAM_APP_SECRET='your_instagram_app_secret'
INSTAGRAM_REDIRECT_URI='https://your-ngrok-or-domain.com/api/auth/instagram/callback'
```

#### 5. Instagram Posting Requirements

- ✅ Must include image or video (text-only posts not supported)
- ✅ Media must be publicly accessible URL (for local dev, upload to CDN first)
- ✅ Uses separate Instagram OAuth (not Facebook Page token)
- ✅ Supports images and videos (including Reels)

### Instagram API Limitations

- **Text-only posts**: Not supported by Instagram API
- **Stories**: Not supported (requires different API)
- **Reels**: Requires `instagram_content_publish` permission and special handling
- **Carousel posts**: Currently supports single image/video

### Troubleshooting

**"Error saving redirect URIs. Verify your redirect URIs and try again."**

- **Cause:** Instagram Business Login does not accept `http://localhost` or other localhost URLs.  
  [Meta’s docs and community confirm this](https://developers.facebook.com/community/threads/875852477849785/).
- **Fix:** Use a public URL:
  - **Local dev:** Use an HTTPS tunnel (e.g. [ngrok](https://ngrok.com/)) and add the tunnel URL (e.g. `https://xxxx.ngrok-free.app/api/auth/instagram/callback`) in Meta and in `INSTAGRAM_REDIRECT_URI`. See **"Local development with ngrok"** above.
  - **Production:** Use your real domain (e.g. `https://yourdomain.com/api/auth/instagram/callback`).

**"Invalid Request: Invalid redirect_uri" when connecting**

1. The redirect URI in Meta (**Set up Instagram business login**) must match `INSTAGRAM_REDIRECT_URI` in `.env` exactly (no trailing slash, same scheme and path).
2. Restart the server after changing `.env`.
3. If using ngrok, open your app via the ngrok URL (not localhost) when testing Connect Instagram.

---

## WhatsApp Business Setup

### How WhatsApp Works in This App

This app uses **WhatsApp Business API via Meta Business** to post status updates. WhatsApp Status is ephemeral (24 hours) and requires media (images or videos).

**Reference**: [WhatsApp Cloud API Documentation](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)

### Prerequisites

1. **WhatsApp Business Account**
   - Create a WhatsApp Business Account in Meta Business Suite
   - Add a phone number to your WhatsApp Business Account
   - Verify the phone number

2. **Facebook Developer App with WhatsApp Product**
   - Use the same Facebook App as your Facebook Page
   - Add the "WhatsApp" product to your app

### Step-by-Step Setup

#### 1. Create WhatsApp Business Account

1. **Go to Meta Business Suite**
   - Visit: https://business.facebook.com/
   - Create or select a Business Account

2. **Add WhatsApp Business Account**
   - Go to **Settings** → **Business Assets** → **WhatsApp Accounts**
   - Click **Add** → **Create WhatsApp Business Account**
   - Follow the setup wizard

3. **Add Phone Number**
   - In your WhatsApp Business Account, go to **Phone Numbers**
   - Add a phone number (can use test number for development)
   - Verify the phone number

#### 2. Configure Facebook App for WhatsApp

1. **Go to Facebook Developers Console**
   - Visit: https://developers.facebook.com/apps/
   - Select your app (same as Facebook Page app)

2. **Add WhatsApp Product**
   - Go to **Products** → **Add Product**
   - Find **WhatsApp** and click **Set Up**

3. **Configure OAuth Redirect URI**
   - Go to **Products** → **WhatsApp** → **Configuration**
   - Add redirect URI:
     ```
     https://siamshoppinghub.com/api/auth/whatsapp/callback
     ```

4. **Request Permissions**
   - Go to **App Review** → **Permissions and Features**
   - Request:
     - `whatsapp_business_management` - Manage WhatsApp Business Account
     - `whatsapp_business_messaging` - Send messages/status

#### 3. Link WhatsApp Business Account to App

1. In **Meta Business Suite**, go to your WhatsApp Business Account
2. Go to **Settings** → **API Setup**
3. Link your Facebook App to the WhatsApp Business Account

#### 4. Configure Environment Variables

Add to your `.env` file:

```bash
# WhatsApp Business API (can use same as Facebook Page app)
WHATSAPP_APP_ID='your_facebook_app_id'  # Same as META_PAGE_APP_ID
WHATSAPP_APP_SECRET='your_facebook_app_secret'  # Same as META_PAGE_APP_SECRET
WHATSAPP_REDIRECT_URI='https://siamshoppinghub.com/api/auth/whatsapp/callback'
```

#### 5. WhatsApp Status Posting Requirements

- ✅ Must include image or video (text-only status not supported)
- ✅ Media must be publicly accessible URL
- ✅ Status is ephemeral (disappears after 24 hours)
- ✅ Uses WhatsApp Business API

### WhatsApp API Limitations

- **Text-only status**: Not supported (requires media)
- **Status duration**: 24 hours (ephemeral)
- **Media format**: Images (JPG, PNG) and Videos (MP4)
- **File size**: Max 16MB for images, 64MB for videos
- **Business verification**: May be required for production use

### Testing WhatsApp

1. Connect WhatsApp Business Account in your app
2. Create a post with an image or video
3. Select WhatsApp platform
4. Post should appear as WhatsApp Status (visible for 24 hours)

---

## Other Meta Platforms

### Messenger Platform (Not Yet Implemented)

Messenger requires:
- `pages_messaging` permission
- Different API for sending messages
- Webhook setup for receiving messages

**Status**: ❌ Not implemented

### Threads (Not Available)

Threads API is not yet publicly available for third-party posting.

**Status**: ❌ API not available

### Messenger Platform (Not Yet Implemented)

Messenger requires:
- `pages_messaging` permission
- Different API for sending messages
- Webhook setup for receiving messages

**Status**: ❌ Not implemented

### Threads (Not Available)

Threads API is not yet publicly available for third-party posting.

**Status**: ❌ API not available

---

## App Review: Permissions This App Uses

When you submit **App Review** for going Live, request at least these permissions so they match what MultiSocial Studio uses:

| Permission | Used for | Required for |
|------------|----------|--------------|
| **pages_show_list** | List user’s Facebook Pages so they can pick one | Facebook Page connect |
| **pages_manage_posts** | Create posts on the selected Page | Facebook Page posting |
| **pages_read_engagement** | Read Page engagement (optional; for future analytics) | Facebook Page |
| **instagram_business_basic** | Read Instagram profile and account info | Instagram connect |
| **instagram_business_content_publish** | Publish posts and media to Instagram | Instagram posting |
| **whatsapp_business_management** | Access WhatsApp Business Account and phone numbers | WhatsApp connect |
| **whatsapp_business_messaging** | Send messages (e.g. status updates) | WhatsApp status posting |

**Checklist before submitting:**

- Add **instagram_business_content_publish** if you want users to *post* to Instagram (not just connect). Your current “Pending requests” list includes `instagram_business_basic` but posting requires `instagram_business_content_publish` as well.
- For Facebook Page posting we use **pages_manage_posts** (not only `pages_manage_metadata`). Include **pages_manage_posts** in the request.
- **Development/Test mode**: Instagram Testers and WhatsApp test numbers can use these features without App Review. Use **Roles → Instagram Testers** and your WhatsApp test number to try the app before going Live.
- After filling in the form and screenshots/demo for each permission, submit the draft. The “Request History” entry (e.g. March 23, 2025) is the previous submission; the current “Draft” is the one you can edit and submit when ready.

---

## Summary: Meta Platforms Status

| Platform | Status | Requirements | Notes |
|----------|--------|--------------|-------|
| **Facebook Page** | ✅ Working | Page permissions | Fully functional |
| **Instagram Business** | ✅ Implemented | Instagram Login API | Requires media |
| **WhatsApp Business** | ❌ Not implemented | Business API access | Requires verification |
| **Messenger** | ❌ Not implemented | Messenger Platform | Different API |
| **Threads** | ❌ Not available | API not public | Limited access |

---

## Additional Resources

- **Facebook Graph API**: https://developers.facebook.com/docs/graph-api
- **Instagram Graph API**: https://developers.facebook.com/docs/instagram-api
- **WhatsApp Business API**: https://developers.facebook.com/docs/whatsapp
- **Messenger Platform**: https://developers.facebook.com/docs/messenger-platform
- **Page Permissions**: https://developers.facebook.com/docs/permissions/reference#pages
- **App Review Guide**: https://developers.facebook.com/docs/app-review
- **Debug Token Tool**: https://developers.facebook.com/tools/debug/accesstoken/
- **Instagram Business Setup**: https://www.facebook.com/business/help/898752960195806
