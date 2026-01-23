import type { Socket } from "socket.io";
import { createRouter, createWebRtcTransport } from "./mediasoup";
import type { Router, Producer } from "mediasoup/types";

type Peer = {
  socket: Socket;
  sendTransport?: any;
  recvTransport?: any;
  producers: Producer[];
};

type Room = {
  router: Router;
  peers: Map<string, Peer>;
};

const rooms = new Map<string, Room>();

function randomRoomId() {
  return Math.random().toString(36).slice(2, 8);
}

export function registerSocketHandlers(socket: Socket) {
  let room: Room | null = null;

  socket.on("create-room", async (cb) => {
    const roomId = randomRoomId();
    const router = await createRouter();

    room = { router, peers: new Map() };
    rooms.set(roomId, room);

    room.peers.set(socket.id, { socket, producers: [] });
    cb({ roomId });
  });

  socket.on("join-room", ({ roomId }, cb) => {
    room = rooms.get(roomId)!;
    room.peers.set(socket.id, { socket, producers: [] });
    cb({ rtpCapabilities: room.router.rtpCapabilities });
  });

  socket.on("create-send-transport", async (cb) => {
    const transport = await createWebRtcTransport(room!.router);
    room!.peers.get(socket.id)!.sendTransport = transport;

    cb({
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    });
  });

  socket.on("connect-send-transport", async ({ dtlsParameters }) => {
    await room!.peers.get(socket.id)!.sendTransport.connect({ dtlsParameters });
  });

  socket.on("produce", async ({ kind, rtpParameters }, cb) => {
    const peer = room!.peers.get(socket.id)!;
    const producer = await peer.sendTransport.produce({ kind, rtpParameters });
    peer.producers.push(producer);

    room!.peers.forEach((p, id) => {
      if (id !== socket.id) {
        p.socket.emit("new-producer", { producerId: producer.id });
      }
    });

    cb({ id: producer.id });
  });

  socket.on("create-recv-transport", async (cb) => {
    const transport = await createWebRtcTransport(room!.router);
    room!.peers.get(socket.id)!.recvTransport = transport;

    cb({
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    });
  });

  socket.on("connect-recv-transport", async ({ dtlsParameters }) => {
    await room!.peers.get(socket.id)!.recvTransport.connect({ dtlsParameters });
  });

  socket.on("consume", async ({ producerId, rtpCapabilities }, cb) => {
    const consumer = await room!.peers.get(socket.id)!.recvTransport.consume({
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
}
