import type { Socket } from "socket.io";
import { getRouter, createWebRtcTransport } from "./mediasoup";
import type { Producer, Consumer } from "mediasoup/types";

/**
 * Global SFU state
 */
const producers = new Map<string, Producer[]>();

export function registerSocketHandlers(socket: Socket) {
  producers.set(socket.id, []);

  socket.on("disconnect", () => {
    const peerProducers = producers.get(socket.id) || [];
    peerProducers.forEach((p) => p.close());
    producers.delete(socket.id);
  });

  socket.on("getRtpCapabilities", (cb) => {
    cb(getRouter().rtpCapabilities);
  });

  // SEND TRANSPORT
  socket.on("createTransport", async (cb) => {
    const transport = await createWebRtcTransport();
    socket.data.sendTransport = transport;

    cb({
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    });
  });

  socket.on("connectTransport", async ({ dtlsParameters }) => {
    await socket.data.sendTransport.connect({ dtlsParameters });
  });

  // PRODUCE
  socket.on("produce", async ({ kind, rtpParameters }, cb) => {
    const producer = await socket.data.sendTransport.produce({
      kind,
      rtpParameters,
    });

    producers.get(socket.id)!.push(producer);

    // notify other peers
    socket.broadcast.emit("new-producer", {
      producerId: producer.id,
    });

    cb({ id: producer.id });
  });

  // RECV TRANSPORT
  socket.on("createRecvTransport", async (cb) => {
    const transport = await createWebRtcTransport();
    socket.data.recvTransport = transport;

    cb({
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    });
  });

  socket.on("connectRecvTransport", async ({ dtlsParameters }) => {
    await socket.data.recvTransport.connect({ dtlsParameters });
  });

  // CONSUME
  socket.on("consume", async ({ producerId, rtpCapabilities }, cb) => {
    const router = getRouter();

    if (
      !router.canConsume({
        producerId,
        rtpCapabilities,
      })
    ) {
      throw new Error("Cannot consume");
    }

    const consumer: Consumer = await socket.data.recvTransport.consume({
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

  // SEND EXISTING PRODUCERS TO NEW PEER
  socket.on("getExistingProducers", (cb) => {
    const list: string[] = [];

    producers.forEach((peerProducers, peerId) => {
      if (peerId !== socket.id) {
        peerProducers.forEach((p) => list.push(p.id));
      }
    });

    cb(list);
  });
}
