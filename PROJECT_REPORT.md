# Social Media Manager - Project Report

## Executive Summary
A full-stack social media management platform enabling users to create, schedule, and publish content across multiple platforms (Facebook, Instagram, LinkedIn, Twitter, YouTube, TikTok, Pinterest, Snapchat) with subscription-based pricing tiers, analytics, and automated scheduling.

---

## Technology Stack

### Frontend
- **Framework**: React 18.3 with TypeScript
- **Routing**: Wouter (lightweight router)
- **State Management**: TanStack Query (React Query) v5
- **UI Components**: Radix UI primitives with shadcn/ui
- **Styling**: Tailwind CSS with custom theme
- **Charts**: Recharts for analytics visualization
- **Forms**: React Hook Form with Zod validation
- **Build Tool**: Vite 5.4

### Backend
- **Runtime**: Node.js with Express 4.21
- **Language**: TypeScript 5.6
- **Database**: PostgreSQL with Drizzle ORM 0.39
- **Authentication**: Passport.js with Local Strategy (scrypt password hashing)
- **Sessions**: Express-session with MemoryStore
- **File Upload**: Multer for media handling
- **Scheduling**: node-cron for automated post publishing
- **Payment**: Stripe API v13 integration
- **Rate Limiting**: express-rate-limit middleware

### Infrastructure
- **Database**: Neon (serverless PostgreSQL) via @neondatabase/serverless
- **Storage**: Local file system for media uploads (`/uploads` directory)
- **Deployment**: Vite build with esbuild bundling for production

---

## Architecture Overview

### Project Structure
```
├── client/          # React frontend application
│   ├── src/
│   │   ├── components/  # UI components (post-editor, schedule-calendar, social-connect)
│   │   ├── pages/       # Route pages (dashboard, analytics, auth)
│   │   ├── hooks/       # Custom React hooks (auth, toast, mobile)
│   │   └── lib/          # Utilities (payment, quota, rate limiter, types)
├── server/          # Express backend API
│   ├── routes.ts    # API route definitions
│   ├── auth.ts      # Authentication setup
│   ├── storage.ts   # Database abstraction layer
│   ├── publishPost.ts    # Post publishing logic
│   └── schedulePost.ts   # Cron job scheduling
├── shared/          # Shared TypeScript schemas
│   └── schema.ts    # Drizzle ORM schema definitions
└── uploads/         # Media file storage
```

### Data Flow
1. **User Authentication**: Passport.js session-based auth with password hashing
2. **Post Creation**: Frontend → API → Validation → Database → Cron Scheduling
3. **Post Publishing**: Cron triggers → Platform API calls → Status updates
4. **Media Handling**: Multer upload → Local storage → Platform-specific upload

---

## Key Features

### 1. Multi-Platform Publishing
- **Supported Platforms**: Facebook (Personal/Page), Instagram, LinkedIn, Twitter, YouTube, TikTok, Pinterest, Snapchat
- **OAuth Integration**: Platform-specific OAuth flows for token management
- **Media Support**: Text, images, videos, and PDFs (platform-dependent)
- **Batch Publishing**: Single post to multiple platforms simultaneously

### 2. Post Scheduling
- **Timezone Support**: User-defined timezone handling with UTC conversion
- **Cron-based Scheduling**: node-cron jobs for automated publishing
- **Persistence**: Scheduled posts reinitialize on server restart
- **Calendar View**: Visual scheduling interface with date picker

### 3. Subscription Management
- **Tier System**: Starter, Pro, Enterprise packages with post quotas
- **Stripe Integration**: Payment processing with webhook handling
- **Quota Enforcement**: Middleware-based post limit checking
- **Usage Tracking**: Monthly post count tracking per user

### 4. Analytics Dashboard
- **Engagement Metrics**: Likes, comments, shares, impressions, clicks
- **Visual Charts**: Recharts bar charts for post performance
- **Statistics**: Total posts, engagement, scheduled posts count

### 5. Rate Limiting
- **Platform-specific Limits**: Per-platform rate limit tracking
- **Time-windowed Counters**: Sliding window rate limit enforcement
- **API Protection**: Express rate limiting (100 req/15min general, 5 req/min auth)

### 6. User Interface
- **Responsive Design**: Mobile-first with Tailwind CSS
- **Component Library**: 50+ shadcn/ui components
- **Real-time Updates**: React Query with auto-refetching
- **Toast Notifications**: User feedback system
- **Protected Routes**: Authentication-based route guards

---

## Database Schema

### Core Tables
- **users**: User accounts with OAuth tokens for each platform, Stripe customer IDs, soft delete support
- **posts**: Post content, scheduling info, platform targets, media URLs, analytics JSON, status tracking
- **subscriptions**: Stripe subscription data, tier associations, period tracking, post usage
- **subscription_tiers**: Tier definitions (name, pricing, post limits)
- **platform_rate_limits**: Per-user, per-platform rate limit tracking with time windows

### Key Relationships
- Users → Posts (1:many, cascade delete)
- Users → Subscriptions (1:many, cascade delete)
- Subscriptions → Subscription Tiers (many:1)
- Users → Platform Rate Limits (1:many, cascade delete)

### Indexes
- Username, email, status, scheduled time, platform arrays, period end dates

---

## Security & Authentication

### Authentication
- **Password Hashing**: scrypt with random salt (64-byte hash)
- **Session Management**: Express-session with MemoryStore
- **CSRF Protection**: Trust proxy configuration
- **Password Validation**: Timing-safe comparison

### API Security
- **Rate Limiting**: IP-based rate limits on API endpoints
- **Authentication Middleware**: Protected routes require session
- **Input Validation**: Zod schemas for all user inputs
- **Error Handling**: Centralized error middleware

### Data Protection
- **Soft Deletes**: `isDeleted` flags instead of hard deletes
- **Token Storage**: Encrypted OAuth tokens in database
- **File Upload Validation**: Multer with file type restrictions

---

## Payment Integration

### Stripe Features
- **Subscription Creation**: Dynamic price creation
- **Webhook Handling**: Subscription status updates
- **Customer Management**: Stripe customer ID linking
- **Payment Methods**: Default payment method setup

### Subscription Flow
1. User selects package → Stripe subscription created
2. Payment intent generated → Client-side confirmation
3. Webhook updates database → Subscription activated
4. Quota middleware enforces limits → Post creation blocked if exceeded

---

## API Endpoints

### Authentication
- `POST /api/register` - User registration
- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `GET /api/user` - Current user info

### Social Media
- `GET /api/auth/:platform` - OAuth initiation (Facebook, LinkedIn)
- `GET /api/facebook/auth/callback` - Facebook OAuth callback
- `GET /api/auth/linkedin/callback` - LinkedIn OAuth callback

### Posts
- `POST /api/posts` - Create post (with media upload, quota check, rate limit check)
- `GET /api/posts` - Get user's posts
- `PATCH /api/posts/:id/status` - Update post status
- `DELETE /api/posts/:postId` - Delete post (soft delete)

### Subscriptions
- `GET /api/subscription` - Get user subscription
- `POST /api/subscription` - Create subscription
- `POST /api/webhooks/stripe` - Stripe webhook handler

### Static
- `GET /uploads/*` - Serve uploaded media files

---

## Frontend Features

### Pages
- **Dashboard**: Post creation, scheduled/published post lists, social connections, calendar view
- **Analytics**: Engagement charts, statistics cards, post performance metrics
- **Auth Page**: Login/registration forms

### Components
- **PostEditor**: Rich text editor with media upload, platform selection, scheduling
- **ScheduleCalendar**: Visual calendar with scheduled post indicators
- **SocialConnect**: Platform connection status and OAuth initiation
- **SubscriptionStatus**: Current plan display with upgrade prompts

### State Management
- **React Query**: Server state caching with 60s refetch intervals
- **Optimistic Updates**: Delete mutations with rollback on error
- **Query Invalidation**: Automatic cache updates on mutations

---

## Current State & Observations

### Strengths
✅ Comprehensive multi-platform support  
✅ Robust subscription and quota system  
✅ Type-safe codebase with TypeScript  
✅ Modern React patterns (hooks, query caching)  
✅ Well-structured database schema with proper indexes  
✅ Security best practices (password hashing, rate limiting)  
✅ Responsive UI with component library  

### Areas for Improvement
⚠️ **Media Storage**: Local file system (should migrate to cloud storage like S3)  
⚠️ **Session Store**: MemoryStore (not suitable for production, should use Redis/PostgreSQL)  
⚠️ **Error Handling**: Some platform errors not fully surfaced to users  
⚠️ **Testing**: No test files present in codebase  
⚠️ **Documentation**: Missing README and API documentation  
⚠️ **Environment Variables**: Need comprehensive `.env` example  
⚠️ **Cron Persistence**: Cron jobs lost on server restart (partially addressed with initialization)  
⚠️ **Platform Coverage**: Some platforms (Twitter, YouTube, TikTok, Pinterest, Snapchat) have token storage but no publishing logic  

### Technical Debt
- Hardcoded port (9002) in server configuration
- Mixed import paths (some using `@/` alias, some relative)
- Large route file (428 lines) could be split into modules
- Storage layer interface could be more type-safe

---

## Recommendations

1. **Production Readiness**: Implement Redis for sessions, cloud storage for media
2. **Testing**: Add unit tests for critical paths (auth, publishing, quota)
3. **Monitoring**: Add logging service (Winston/Pino) and error tracking (Sentry)
4. **Documentation**: Create API docs (OpenAPI/Swagger) and deployment guide
5. **Platform Expansion**: Complete publishing logic for remaining platforms
6. **Performance**: Implement database connection pooling, query optimization
7. **CI/CD**: Set up automated testing and deployment pipelines

---

**Report Generated**: January 2025  
**Project Status**: Functional MVP with production considerations needed

