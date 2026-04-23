import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import dotenv from "dotenv";
import { sanitizeUserForClient } from "./sanitize-user";
import { getFeatureFlag, FEATURE_KEYS } from "./feature-config";
import { getUserCapabilities } from "./user-capabilities";
import { z } from "zod";

dotenv.config(); // Load environment variables

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function getSafeCompanyContext(userId: number) {
  try {
    return await storage.getUserCompanyContext(userId);
  } catch (error) {
    // Keep auth/session usable even when tenant tables are not migrated yet.
    console.warn("[AUTH] Company context unavailable, continuing without tenant context:", error);
    return null;
  }
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export async function verifyPassword(supplied: string, stored: string) {
  return comparePasswords(supplied, stored);
}

export function setupAuth(app: Express) {
  const buildSessionUser = async (u: SelectUser) => {
    const companyCtx = await getSafeCompanyContext(u.id);
    return {
      ...sanitizeUserForClient(u),
      companyMembership: companyCtx?.membership ?? null,
      company: companyCtx?.company ?? null,
      capabilities: getUserCapabilities(u, {
        companyPackageTier: (companyCtx?.company?.packageTier as "basic" | "advance" | undefined),
        companyOpenRouterApiKey: companyCtx?.company?.openrouterApiKey ?? null,
        membershipAiEnabled: companyCtx?.membership?.aiEnabled ?? true,
      }),
    };
  };

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET ?? 'dev-secret-key',
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      {
        usernameField: 'username',
        passwordField: 'password',
      },
      async (username, password, done) => {
        try {
          console.log(`[AUTH] Login attempt for username: "${username}"`);
          const user = await storage.getUserByUsername(username);
          if (!user) {
            console.log(`[AUTH] ❌ User "${username}" not found`);
            return done(null, false, { message: "Invalid username or password" });
          }
          
          console.log(`[AUTH] ✅ User found: ${user.username} (ID: ${user.id})`);
          const passwordMatch = await comparePasswords(password, user.password);
          if (!passwordMatch) {
            console.log(`[AUTH] ❌ Invalid password for user "${username}"`);
            return done(null, false, { message: "Invalid username or password" });
          }

          if (user.role !== "super_admin" && user.isApproved === false) {
            return done(null, false, {
              message: "Your account is pending administrator approval. You will be notified when access is ready.",
            });
          }

          console.log(`[AUTH] ✅✅✅ Login successful for user "${username}"`);
          return done(null, user);
        } catch (error) {
          console.error("[AUTH] ❌ Login error:", error);
          return done(error);
        }
      }
    ),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    const user = await storage.getUser(id);
    done(null, user);
  });

  app.post("/api/register", async (req, res, next) => {
    const allowEnv = process.env.ALLOW_PUBLIC_REGISTRATION === "true";
    const allowFlag = await getFeatureFlag(FEATURE_KEYS.PUBLIC_REGISTRATION_ENABLED);
    if (!allowEnv && !allowFlag) {
      return res.status(403).json({
        error:
          "Self-registration is disabled. Use Request access on the site or contact your administrator.",
        code: "REGISTRATION_DISABLED",
      });
    }

    const existingUser = await storage.getUserByUsername(req.body.username);
    if (existingUser) {
      return res.status(400).send("Username already exists");
    }

    const user = await storage.createUser({
      ...req.body,
      password: await hashPassword(req.body.password),
    });

    req.login(user, (err) => {
      if (err) return next(err);
      void (async () => {
        res.status(201).json(await buildSessionUser(user));
      })().catch(next);
    });
  });

  app.post("/api/login", (req, res, next) => {
    console.log(`[LOGIN API] Received login request:`, {
      username: req.body?.username,
      hasPassword: !!req.body?.password,
      bodyKeys: Object.keys(req.body || {})
    });
    
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        console.error("[LOGIN API] ❌ Authentication error:", err);
        return res.status(500).json({ error: "Internal server error" });
      }
      if (!user) {
        console.log(`[LOGIN API] ❌ Authentication failed:`, info?.message);
        return res.status(401).json({ 
          error: info?.message || "Invalid username or password" 
        });
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error("[LOGIN API] ❌ Session creation error:", loginErr);
          return res.status(500).json({ error: "Failed to establish session" });
        }
        console.log(`[LOGIN API] ✅✅✅ Login successful, session created for: ${user.username}`);
        void (async () => {
          return res.status(200).json(await buildSessionUser(user));
        })().catch((e) => {
          console.error("[LOGIN API] ❌ Response build error:", e);
          return res.status(500).json({ error: "Failed to complete login" });
        });
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const u = req.user!;
    void (async () => {
      res.json(await buildSessionUser(u));
    })().catch(() => {
      res.status(500).json({ error: "Failed to load user session" });
    });
  });

  app.patch("/api/account/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const body = z
        .object({
          username: z.string().trim().min(3).max(64),
          email: z.string().trim().email().max(254),
        })
        .parse(req.body);

      const existingByUsername = await storage.getUserByUsername(body.username);
      if (existingByUsername && existingByUsername.id !== req.user!.id) {
        return res.status(409).json({ error: "Username is already taken." });
      }

      const updated = await storage.updateUserProfile(req.user!.id, {
        username: body.username,
        email: body.email,
      });

      return res.status(200).json(await buildSessionUser(updated));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid profile details." });
      }
      return res.status(500).json({ error: "Failed to update profile." });
    }
  });

  app.patch("/api/account/password", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const body = z
        .object({
          currentPassword: z.string().min(1),
          newPassword: z
            .string()
            .min(8)
            .max(128)
            .regex(/[A-Za-z]/, "Password must include a letter.")
            .regex(/[0-9]/, "Password must include a number."),
        })
        .parse(req.body);

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ error: "User not found." });

      const validCurrent = await verifyPassword(body.currentPassword, user.password);
      if (!validCurrent) {
        return res.status(400).json({ error: "Current password is incorrect." });
      }

      const passwordHash = await hashPassword(body.newPassword);
      await storage.updateUserPasswordHash(user.id, passwordHash);
      return res.status(200).json({ ok: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid password details." });
      }
      return res.status(500).json({ error: "Failed to update password." });
    }
  });
}
