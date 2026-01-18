// src/index.ts
import express from "express";
import http from "http";
import { Server } from "socket.io";
import { initMediasoup } from "./mediasoup";
import { registerSocketHandlers } from "./signalling";

async function startServer() {
  // 1. INIT MEDIASOUP (ONCE)
  await initMediasoup();

  // 2. CREATE HTTP SERVER
  const app = express();
  const server = http.createServer(app);

  // 3. SOCKET.IO
  const io = new Server(server, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    registerSocketHandlers(socket);
  });

  // 4. LISTEN
  server.listen(4000, () => {
    console.log("Server running on port 4000");
  });
}

startServer().catch(console.error);
