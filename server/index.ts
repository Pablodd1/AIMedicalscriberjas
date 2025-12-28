import 'dotenv/config';
import { log, logError } from './logger';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { globalErrorHandler } from "./error-handler";
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import winston from 'winston';
import expressWinston from 'express-winston';
import crypto from 'crypto';

// ==========================================
// CRITICAL: Global error handlers to prevent container crashes
// ==========================================
process.on('uncaughtException', (error) => {
  logError('UNCAUGHT EXCEPTION - Application will continue:', error);
  // Log but don't exit - allow the app to continue
});

process.on('unhandledRejection', (reason, promise) => {
  logError('UNHANDLED REJECTION', reason as Error, { promise });
  // Log but don't exit - allow the app to continue
});

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

const app = express();

// ==========================================
// SECURITY: Helmet for security headers
// ==========================================
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for development compatibility
  crossOriginEmbedderPolicy: false, // Allow embedding
}));

// ==========================================
// SECURITY: Rate limiting to prevent abuse
// ==========================================
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit login attempts to 20 per 15 minutes
  message: { error: 'Too many login attempts, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
});

// Apply rate limiters
app.use('/api/login', authLimiter);
app.use('/api/register', authLimiter);
app.use('/api/', generalLimiter);

app.use(express.json({ limit: '50mb' })); // Increase JSON limit for base64 audio/images
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Add request ID
app.use((req, res, next) => {
  const requestId = crypto.randomBytes(16).toString('hex');
  req.id = requestId;
  next();
});

// Request logging middleware
app.use(expressWinston.logger({
  transports: [new winston.transports.Console()],
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  meta: true,
  msg: "HTTP {{req.method}} {{req.url}}",
  expressFormat: true,
  colorize: false,
  dynamicMeta: (req, res) => {
    const meta: any = {
      requestId: req.id,
      ip: req.ip,
    };
    if (req.user) {
      meta.user = {
        id: req.user.id,
        username: req.user.username,
      };
    }
    return meta;
  }
}));

(async () => {
  const server = await registerRoutes(app);

  // Use our comprehensive error handler
  app.use(globalErrorHandler);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Set server timeout to 10 minutes for large uploads
  server.timeout = 600000;
  server.keepAliveTimeout = 610000;
  server.headersTimeout = 620000;

  // Use Railway's PORT environment variable in production, fallback to 5000 for local development
  const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
  server.listen({
    port,
    host: "0.0.0.0"
  }, () => {
    log(`serving on port ${port}`);
  });
})();
