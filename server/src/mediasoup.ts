import * as mediasoup from "mediasoup";
import type {
  Worker,
  Router,
  WebRtcTransport,
  Producer,
  Consumer,
} from "mediasoup/types";
import { peers } from ".";
import { mediaCodecs } from "./mediaCodecs";
import { DefaultSerializer } from "node:v8";

let worker: Worker;
let router: Router;
let producerTransport: WebRtcTransport;
let consumerTransport: WebRtcTransport;
let producer: Producer | undefined;
let consumer: Consumer | undefined;

const createWorker = async (): Promise<
  mediasoup.types.Worker<mediasoup.types.AppData>
> => {
  // create a mediasoup worker with specific configuration

  const newWorker = await mediasoup.createWorker({
    rtcMinPort: 2000, //Minimum port number for RTC traffic
    rtcMaxPort: 2020, // Maximum port number for RTC traffic
  });

  console.log(`Worker process ID ${newWorker.pid}`);

  //Event handler for the "died" event on worker
  newWorker.on("died", (error) => {
    console.log("MediaSoup worker has died");

    // gradually shut down the process to allow for recovery for troubleshooting
    setTimeout(() => {
      process.exit();
    }, 2000);
  });
  worker = newWorker;
  return newWorker;
};

peers.on("connection", async (socket) => {
  // ...Peer connection event handling....

  /**
   * Create a Router,
   * Since there are only two peers in this demo, we only need one router for each peer,
   * In more complex app, we may need multiple routers to handle multiple peers,
   * A router is required to route media to/from this peer,
   */

  router = await worker.createRouter({
    mediaCodecs: mediaCodecs,
  });

  /**
   * Event handler for fetching router RTP capabilities.
   * RTP capabilities are required for configuration transports and producers/consume.
   * This funciton is called when a peer requests the router RTP capabilities.
   * The callback function is used to send the router RTP capabilities to the peer.
   */

  socket.on("getRouterRtpCapabilities", (callback) => {
    /// .... Handling router RTP capabilities ....
  });

  /**
   * Event handler for creating transport.
   * A transport is required for sending or producing media.
   * The callback funciton is used to send the transport parameters to the peer.
   * The Callback funciton is used to send the transport params to the peer,
   * @param {boolean} data.sender - Indicates whether the transport is for sending or receiving media,
   * @param {function} callback - A cb function to handle the result of the transport creation,
   */

  socket.on("createTransport", async ({ sender }, callback) => {
    // ... Creating sender/receiver transports....
  });

  /**
   * Event handler for producing media,
   * The function sets up a producer for sending media to the peer.
   * A producer represents the source of a single media track (audio or Video);
   * @param {object} data.dtlsParameters - Datagram Transport Layer Security (DTLS) params,
   * These params are necessary for securing the transport with encryption.
   */

  socket.on("connectProducerTransport", async ({ dtlsParameters }) => {
    /// ... Connecting the receiving transport ....
  });

  // Event handler for producing media
  socket.on("transport-produce", async ({ kind, rtpParameters }, callback) => {
    /// ..Producing media
  });

  // Event handler for connecting the receiver transport

  socket.on("connectConsumerTransport", async ({ dtlsParameters }) => {
    /// ...Connecting the receiving transport....;
  });

  /**
   * Event handler for consuming media
   * This func sets up a consumer for receiving media from the peer,
   * A consumer represents the endpoint for receiving media of single kind
   * (audio or video) from a remote peer. Creating a consumer involves multiple steps to ensure that the media can be received and decoded correctly
   *
   */

  socket.on("consumeMedia", async ({ rtpCapabilities }, callback) => {
    // ... Consuming media.....
  });

  // Event handler for resuming media consumption
  socket.on("resumePausedConsumer", async (data) => {
    // ... Resuming media consumption
  });
});

const createWebRtcTransport = async (
  callback: (arg0: {
    params: mediasoup.types.WebRtcTransportOptions | { error: unknown };
  }) => void,
) => {
  // ... WebRTC transport creation, configuration, and event handling ...
};
