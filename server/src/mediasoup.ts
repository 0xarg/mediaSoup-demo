import * as mediasoup from "mediasoup";

import type { Worker, Router, WebRtcTransport } from "mediasoup/types";

let worker: Worker;
let router: Router;

export async function initMediasoup() {
  worker = await mediasoup.createWorker({
    rtcMinPort: 40000,
    rtcMaxPort: 49999,
    logLevel: "debug",
    logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"],
  });

  worker.on("died", () => {
    console.log("MediaSoup Worker died,");
    process.exit(1);
  });

  router = await worker.createRouter({
    mediaCodecs: [
      {
        kind: "video",
        mimeType: "video/VP8",
        clockRate: 90000,
      },
      {
        kind: "audio",
        mimeType: "audio/opus",
        clockRate: 48000,
        channels: 2,
      },
    ],
  });
}

export function getRouter(): Router {
  return router;
}

export async function createWebRtcTransport(): Promise<WebRtcTransport> {
  return router.createWebRtcTransport({
    listenIps: [{ ip: "0.0.0.0" }],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  });
}
