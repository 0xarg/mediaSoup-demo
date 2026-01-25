/**
 * This file contains:
 * - mediasoup initialization
 * - room management
 * - all Socket.IO signaling
 *
 * NO logic is hidden elsewhere.
 */

import express from "express";
import http from "http";
import { Server } from "socket.io";
import * as mediasoup from "mediasoup";
import type {
  Worker,
  Router,
  WebRtcTransport,
  Producer,
} from "mediasoup/types";

/* ============================================================
   1. BASIC SERVER SETUP
   ============================================================ */

const app = express();
const server = http.createServer(app);

/**
 * Socket.IO server
 * - Used ONLY for signaling (no media ever goes here)
 */
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000"], // add LAN / ngrok URL when needed
  },
});

/* ============================================================
   2. MEDIASOUP GLOBAL STATE
   ============================================================ */

/**
 * mediasoup Worker
 * - This is the OS-level process that handles RTP packets
 * - MUST exist before any router/transport is created
 */
let worker: Worker;

/**
 * Room structure
 * Each room has:
 * - its own Router
 * - a map of connected peers
 */
type Peer = {
  socketId: string;
  sendTransport?: WebRtcTransport;
  recvTransport?: WebRtcTransport;
  producers: Producer[];
};

type Room = {
  router: Router;
  peers: Map<string, Peer>;
};

/**
 * All rooms live in this Map
 * key   → roomId (string)
 * value → Room object
 */
const rooms = new Map<string, Room>();

/* ============================================================
   3. MEDIASOUP INITIALIZATION
   ============================================================ */

/**
 * Create mediasoup Worker ONCE at startup
 */
async function initMediasoup() {
  worker = await mediasoup.createWorker();

  worker.on("died", () => {
    console.error("mediasoup worker died");
    process.exit(1);
  });
}

/**
 * Create a Router for a room
 * - Router defines allowed codecs
 * - One router per room
 */
async function createRouter(): Promise<Router> {
  return worker.createRouter({
    mediaCodecs: [
      {
        kind: "video",
        mimeType: "video/VP8",
        clockRate: 90000,
      },
    ],
  });
}

/**
 * Create a WebRTC transport
 * - Used for sending OR receiving media
 */
async function createWebRtcTransport(router: Router): Promise<WebRtcTransport> {
  return router.createWebRtcTransport({
    listenIps: [
      {
        ip: "0.0.0.0",
      },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  });
}

/* ============================================================
   4. ROOM HELPER
   ============================================================ */

/**
 * Get an existing room or create a new one
 */
async function getOrCreateRoom(roomId: string): Promise<Room> {
  if (!rooms.has(roomId)) {
    const router = await createRouter();

    rooms.set(roomId, {
      router,
      peers: new Map(),
    });
  }

  return rooms.get(roomId)!;
}

/* ============================================================
   5. SOCKET.IO LOGIC (CORE OF THE APP)
   ============================================================ */

io.on("connection", (socket) => {
  /**
   * Each socket represents ONE peer
   */
  let currentRoom: Room | null = null;

  /* -------------------------------
     JOIN ROOM
     ------------------------------- */
  socket.on("join-room", async ({ roomId }, cb) => {
    /**
     * Get or create the room
     */
    currentRoom = await getOrCreateRoom(roomId);

    /**
     * Register this peer in the room
     */
    currentRoom.peers.set(socket.id, {
      socketId: socket.id,
      producers: [],
    });

    /**
     * Send router RTP capabilities to client
     * Client needs this to initialize mediasoup Device
     */
    cb({ rtpCapabilities: currentRoom.router.rtpCapabilities });
  });

  /* -------------------------------
     CREATE SEND TRANSPORT
     ------------------------------- */
  socket.on("create-send-transport", async (cb) => {
    const transport = await createWebRtcTransport(currentRoom!.router);

    currentRoom!.peers.get(socket.id)!.sendTransport = transport;

    cb({
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    });
  });

  /* -------------------------------
     CONNECT SEND TRANSPORT
     ------------------------------- */
  socket.on("connect-send-transport", async ({ dtlsParameters }) => {
    await currentRoom!.peers
      .get(socket.id)!
      .sendTransport!.connect({ dtlsParameters });
  });

  /* -------------------------------
     PRODUCE MEDIA
     ------------------------------- */
  socket.on("produce", async ({ kind, rtpParameters }, cb) => {
    const peer = currentRoom!.peers.get(socket.id)!;

    const producer = await peer.sendTransport!.produce({
      kind,
      rtpParameters,
    });

    peer.producers.push(producer);

    /**
     * Notify OTHER peers in the same room
     */
    currentRoom!.peers.forEach((p) => {
      if (p.socketId !== socket.id) {
        io.to(p.socketId).emit("new-producer", {
          producerId: producer.id,
        });
      }
    });

    cb({ id: producer.id });
  });

  /* -------------------------------
     CREATE RECV TRANSPORT
     ------------------------------- */
  socket.on("create-recv-transport", async (cb) => {
    const transport = await createWebRtcTransport(currentRoom!.router);

    currentRoom!.peers.get(socket.id)!.recvTransport = transport;

    cb({
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    });
  });

  /* -------------------------------
     CONNECT RECV TRANSPORT
     ------------------------------- */
  socket.on("connect-recv-transport", async ({ dtlsParameters }) => {
    await currentRoom!.peers
      .get(socket.id)!
      .recvTransport!.connect({ dtlsParameters });
  });

  /* -------------------------------
     CONSUME MEDIA
     ------------------------------- */
  socket.on("consume", async ({ producerId, rtpCapabilities }, cb) => {
    const consumer = await currentRoom!.peers
      .get(socket.id)!
      .recvTransport!.consume({
        producerId,
        rtpCapabilities,
        paused: false,
      });

    cb({
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    });
  });

  /* -------------------------------
     DISCONNECT
     ------------------------------- */
  socket.on("disconnect", () => {
    currentRoom?.peers.delete(socket.id);
  });
});

/* ============================================================
   6. START SERVER
   ============================================================ */

async function start() {
  await initMediasoup();

  server.listen(4000, () => {
    console.log("Server running on http://localhost:4000");
  });
}

start();
