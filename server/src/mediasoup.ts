import * as mediasoup from "mediasoup";
import type {
  Worker,
  Router,
  WebRtcTransport,
  Producer,
  Consumer,
} from "mediasoup/types";

let worker: Worker;
let router: Router;
let producerTransport: WebRtcTransport;
let consumerTransport: WebRtcTransport;
let producer: Producer | undefined;
let consumer: Consumer | undefined;

export async function initMediasoup() {
  worker = await mediasoup.createWorker();
}

export async function createRouter(): Promise<Router> {
  return worker.createRouter({
    mediaCodecs: [{ kind: "video", mimeType: "video/VP8", clockRate: 90000 }],
  });
}

export async function createWebRtcTransport(
  router: Router,
): Promise<WebRtcTransport> {
  return router.createWebRtcTransport({
    listenIps: [{ ip: "0.0.0.0" }],
    enableUdp: true,
    enableTcp: true,
  });
}
