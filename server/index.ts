import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startSystemMonitoring } from "./system-monitor";
import { initWebSocketServer } from "./websocket-service";
import cookieParser from "cookie-parser";
import { type IStorage, initializeStorage, storage } from "./storage";

// 環境変数の設定（.envファイル不要のため削除）
console.log("デフォルト環境設定を使用します");

/**
 * SHK (Sui-Han-Ki) Web Proxy implementation for enhanced stability in Replit
 * 
 * This implementation includes system monitoring and resource management
 * to prevent crashes in the Replit environment.
 * 
 * Provides a simple and effective web proxy service focusing on privacy and performance.
 */

// ストレージ初期化ラッパー関数
export async function initStorage(): Promise<IStorage> {
  console.log('ストレージを初期化中...');
  return await initializeStorage();
}

// 環境設定は初期化済み

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser()); // Cookieパーサーを追加

// Enhanced request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
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

// IIFE to start the server
(async () => {
  // ストレージを初期化（storage.tsのinitializeStorage関数を使用）
  console.log('ストレージを初期化中...');
  let storageInstance = await initializeStorage();
  console.log('ストレージの初期化が完了しました');
  
  // Register API routes as usual
  const server = await registerRoutes(app);

  // Add health check endpoint for increased stability
  app.get("/api/health/system", (_req: Request, res: Response) => {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    res.json({
      status: "ok",
      uptime: uptime,
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024) + "MB",
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + "MB",
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + "MB",
        external: Math.round((memoryUsage.external || 0) / 1024 / 1024) + "MB",
      },
      timestamp: new Date().toISOString()
    });
  });

  // Add global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    console.error("Error occurred:", err);
  });

  // Set up Vite in development mode
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Use environment PORT variable if available, fallback to 5000 (for Replit)
  const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;

  // Start system monitoring for stability
  startSystemMonitoring();
  log("Starting server with SHK (Sui-Han-Ki) implementation for enhanced stability", "shk");

  // Start HTTP server
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`Server running on port ${port} with stability monitoring enabled (${process.env.NODE_ENV || 'development'} mode)`);
    
    // WebSocketサーバーを初期化して、リアルタイム通信を有効化
    initWebSocketServer(server);
  });
  
  // Error handling for the server
  server.on('error', (error: Error) => {
    console.error('Server error:', error);
    
    // Check if we're in production (Render) or development (Replit)
    if (process.env.NODE_ENV === 'production') {
      // In production, log the error but don't attempt auto-recovery
      // as this might interfere with Render's own process management
      log('Server error in production environment. Waiting for platform restart.', 'error');
      
      // In extreme cases, we can exit and let the platform restart us
      if (error.message.includes('EADDRINUSE')) {
        log('Port already in use. Exiting for platform-managed restart.', 'error');
        process.exit(1);
      }
    } else {
      // In development, attempt recovery
      setTimeout(() => {
        log('Attempting to recover from server error...', 'recovery');
        server.listen({
          port,
          host: "0.0.0.0",
          reusePort: true,
        });
      }, 5000); // Wait 5 seconds before trying to restart
    }
  });
})();
