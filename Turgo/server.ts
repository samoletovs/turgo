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

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handler);

  // Initialize Socket.IO on the same HTTP server
  const io = initSocketServer(httpServer);

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.IO server running on path /api/socketio`);
  });
});
