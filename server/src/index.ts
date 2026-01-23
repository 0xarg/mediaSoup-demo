import express from "express";
import http from "http";
import cors from "cors";
import mediasoup from "mediasoup";
import { Server } from "socket.io";

const app = express();
const port = 4000;
const server = http.createServer(app);

// Initialize a Socket.IO server for WebSocket connections.
const io = new Server(server, {
  cors: {
    origin: "*",
    credentials: true,
  },
});

// Create a namespace "/mediasoup" for mediasoup-related socket events
const peers = io.of("/mediasoup");

// After this we init Worker and Router
