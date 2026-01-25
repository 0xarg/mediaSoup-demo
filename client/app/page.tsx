/**
 * This single file:
 * - Shows landing UI
 * - Joins room
 * - Handles all WebRTC logic
 *
 * No hidden helpers.
 */

"use client";

import { useRef, useState } from "react";
import { io } from "socket.io-client";
import { Device } from "mediasoup-client";

let remoteCount = 1;

export default function Page() {
  const localVideo = useRef<HTMLVideoElement>(null);
  const [socket, setSocket] = useState<any>(null);

  /* ============================================================
     JOIN ROOM
     ============================================================ */

  async function joinRoom(roomId: string) {
    /**
     * Connect to signaling server
     */
    const socket = io("localhost:4000");
    setSocket(socket);

    /**
     * Ask server to join room
     */
    const { rtpCapabilities } = await new Promise<any>((res) =>
      socket.emit("join-room", { roomId }, res),
    );

    /**
     * Create mediasoup Device
     */
    const device = new Device();
    await device.load({ routerRtpCapabilities: rtpCapabilities });

    /**
     * Get camera
     * IMPORTANT: must be HTTPS on mobile
     */
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    localVideo.current!.srcObject = stream;

    /* -------------------------------
       SEND TRANSPORT
       ------------------------------- */
    const sendParams = await new Promise<any>((res) =>
      socket.emit("create-send-transport", res),
    );

    const sendTransport = device.createSendTransport(sendParams);

    sendTransport.on("connect", ({ dtlsParameters }, cb) => {
      socket.emit("connect-send-transport", { dtlsParameters });
      cb();
    });

    sendTransport.on("produce", ({ kind, rtpParameters }, cb) => {
      socket.emit("produce", { kind, rtpParameters }, cb);
    });

    await sendTransport.produce({
      track: stream.getVideoTracks()[0],
    });

    /* -------------------------------
       RECV TRANSPORT
       ------------------------------- */
    const recvParams = await new Promise<any>((res) =>
      socket.emit("create-recv-transport", res),
    );

    const recvTransport = device.createRecvTransport(recvParams);

    recvTransport.on("connect", ({ dtlsParameters }, cb) => {
      socket.emit("connect-recv-transport", { dtlsParameters });
      cb();
    });

    /* -------------------------------
       HANDLE NEW PRODUCERS
       ------------------------------- */
    socket.on("new-producer", async ({ producerId }) => {
      const params = await new Promise<any>((res) =>
        socket.emit(
          "consume",
          { producerId, rtpCapabilities: device.rtpCapabilities },
          res,
        ),
      );

      const consumer = await recvTransport.consume(params);

      const video = document.createElement("video");
      video.autoplay = true;
      video.playsInline = true;
      video.srcObject = new MediaStream([consumer.track]);

      const label = document.createElement("div");
      label.innerText = `Remote Camera #${remoteCount++}`;

      document.body.append(label, video);
    });
  }

  return (
    <main>
      <button onClick={() => joinRoom("room1")}>Join Room</button>

      <h3>Local Camera</h3>
      <video ref={localVideo} autoPlay playsInline />
    </main>
  );
}
