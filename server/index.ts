import "./env-bootstrap";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import rateLimit from 'express-rate-limit';
import { initializeFeatureFlags } from "./feature-config";
import { initializeNotificationSettings } from "./notification-config";
import { handleStripeWebhook } from "./stripe-advance";

const app = express();

// Stripe webhooks need the raw body for signature verification (must run before express.json).
app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  (req, res) => {
    void handleStripeWebhook(req, res);
  }
);

// Middleware for parsing JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
});

app.use("/api/", (req, res, next) => {
  if (req.path === "/webhooks/stripe" || req.originalUrl.startsWith("/api/webhooks/stripe")) {
    return next();
  }
  return apiLimiter(req, res, next);
});
app.use('/api/auth', rateLimit({ 
  windowMs: 60 * 1000, 
  max: 5 
}));

// Custom logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  // Capture the response JSON for logging
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  // Log the request details when the response finishes
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      // Truncate long log lines
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(status).json({ message });
  log(`Error: ${status} - ${message}`);
  if (status >= 500) {
    console.error(err); // Log server errors for debugging
  }
});

// Start the server
(async () => {
  try {
    // Initialize feature flags
    await initializeFeatureFlags();
    await initializeNotificationSettings();

    const server = await registerRoutes(app);

    // Setup Vite in development mode
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app); // Serve static files in production
    }

    // Start the server on port 3000 (or fallback to another port)
    const port = 9002;
    log(`Attempting to start server on port ${port}...`);

    server.listen(port, "0.0.0.0", () => {
      log(`Server is running on http://0.0.0.0:${port}`);
    }).on("error", (err: NodeJS.ErrnoException) => { // Type assertion
      if (err.code === "EADDRINUSE") {
        log(`Port ${port} is already in use. Trying another port...`);
        server.listen(port + 1, "0.0.0.0", () => {
          log(`Server is running on http://0.0.0.0:${port + 1}`);
        });
      } else {
        console.error("Server failed to start:", err);
        process.exit(1);
      }
    });
  } catch (error) {
    console.error("Failed to start the server:", error);
    process.exit(1); // Exit the process if the server fails to start
  }
})();