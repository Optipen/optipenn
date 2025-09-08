import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic, log } from "./static";
import { validateEnvironmentVariablesOrThrow } from "./env-validation";
import cookieParser from "cookie-parser";
import cors from "cors";
import { logger } from "./logger";
import { metrics } from "./metrics";
import { randomUUID } from "crypto";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Add security headers for production
if (process.env.NODE_ENV === "production") {
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Prevent clickjacking
    res.setHeader("X-Frame-Options", "DENY");
    // Prevent MIME type sniffing
    res.setHeader("X-Content-Type-Options", "nosniff");
    // Enable XSS protection
    res.setHeader("X-XSS-Protection", "1; mode=block");
    // Referrer policy for privacy
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    // Content Security Policy for cookie protection
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
    next();
  });
}
// CORS if needed (configure origin via env)
const allowOrigin = process.env.CORS_ORIGIN;
if (allowOrigin) {
  app.use(cors({ origin: allowOrigin.split(",").map((s) => s.trim()), credentials: true }));
}

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const requestId = randomUUID();
  const path = req.path;
  
  // Add request ID to request object for correlation
  (req as any).requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson: any, ...args: any[]) {
    capturedJsonResponse = bodyJson;
    return originalResJson.call(res, bodyJson);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    
    // Record metrics
    metrics.recordRequest(statusCode, duration);
    
    if (path.startsWith("/api")) {
      // Structured logging with proper context
      const logContext = {
        requestId,
        method: req.method,
        path,
        duration,
        status: statusCode,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
      };

      const message = `${req.method} ${path} ${statusCode}`;
      
      if (statusCode >= 500) {
        logger.error(message, logContext);
      } else if (statusCode >= 400) {
        logger.warn(message, logContext);
      } else {
        logger.info(message, logContext);
      }

      // Log response data for debugging (only in development)
      if (capturedJsonResponse && process.env.NODE_ENV === "development") {
        logger.debug("Response data", { 
          ...logContext, 
          response: JSON.stringify(capturedJsonResponse).slice(0, 500) 
        });
      }

      // Legacy logging for compatibility
      let logLine = `${req.method} ${path} ${statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Validation obligatoire des variables d'environnement sensibles
  try {
    logger.info("Starting OptiPen CRM server...");
    log("Validation des variables d'environnement...");
    validateEnvironmentVariablesOrThrow();
    log("✓ Variables d'environnement validées avec succès");
    logger.info("Environment variables validated successfully");
  } catch (error) {
    const errorMsg = (error as Error).message;
    console.error("\n" + errorMsg);
    logger.error("Environment validation failed", {}, error as Error);
    process.exit(1);
  }

  const server = await registerRoutes(app);
  
  // start schedulers
  try {
    const { startSchedulers } = await import("./notifications");
    startSchedulers();
    logger.info("Notification schedulers started");
  } catch (error) {
    logger.warn("Failed to start notification schedulers", { error: (error as Error).message });
  }

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    const requestId = (req as any).requestId;

    // Structured error logging
    logger.error("Request error", {
      requestId,
      method: req.method,
      path: req.path,
      status,
      error: message,
      stack: err.stack?.split('\n').slice(0, 5).join('\n'), // First 5 lines of stack
    }, err);

    res.status(status).json({ 
      message,
      requestId: process.env.NODE_ENV === "development" ? requestId : undefined 
    });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen(port, () => {
    const message = `Server running on port ${port} in ${process.env.NODE_ENV || 'development'} mode`;
    log(`serving on port ${port}`);
    logger.info(message, { 
      port, 
      environment: process.env.NODE_ENV || 'development',
      pid: process.pid
    });
  });
})();
