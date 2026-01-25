import * as mediasoup from "mediasoup";
import type { Worker, Router, WebRtcTransport } from "mediasoup/types";

let worker: Worker;

export async function initMediasoup() {
  worker = await mediasoup.createWorker({
    rtcMinPort: 40000,
    rtcMaxPort: 49999,
  });

  worker.on("died", () => {
    console.error("mediasoup worker died");
    process.exit(1);
  });
}

export async function createRouter(): Promise<Router> {
  if (!worker) {
    throw new Error("mediasoup worker not initialized");
  }

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

export async function createWebRtcTransport(
  router: Router,
): Promise<WebRtcTransport> {
  return router.createWebRtcTransport({
    listenIps: [
      {
        ip: "0.0.0.0",
        announcedIp: "192.168.31.209", // YOUR LAN IP
      },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  });
}
