/**
 * Custom Next.js server with Socket.IO integration
 * Run with: node server.mjs (or tsx server.ts)
 *
 * This file bootstraps the Next.js app with a shared HTTP server
 * that also hosts the Socket.IO WebSocket connections.
 */

import { createServer } from "http";
import next from "next";
import { initSocketServer } from "./src/server/socket.js";
import { initSearchIndex } from "./src/server/services/search.js";
import {
  initializeOrchestrator,
  shutdownOrchestrator,
} from "./src/server/services/agent-orchestrator.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);
const enableAgents = process.env.ENABLE_AGENTS === "true";

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(async () => {
  const httpServer = createServer(handler);

  // Initialize Socket.IO on the same HTTP server
  await initSocketServer(httpServer);

  // Initialize search index (Meilisearch)
  await initSearchIndex();

  // Initialize agent orchestrator (BullMQ workers & CRON jobs)
  if (enableAgents) {
    await initializeOrchestrator();
  } else {
    console.log(
      "> Agent orchestrator disabled (set ENABLE_AGENTS=true to enable)",
    );
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n> Received ${signal}, shutting down...`);
    if (enableAgents) {
      await shutdownOrchestrator();
    }
    httpServer.close(() => {
      console.log("> HTTP server closed");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.IO server running on path /api/socketio`);
  });
});
