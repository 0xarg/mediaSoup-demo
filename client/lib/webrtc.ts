import { Device } from "mediasoup-client";

import type { Transport, RtpCapabilities } from "mediasoup-client/types";

import { io, Socket } from "socket.io-client";

export async function startWebRTC() {
  const socket: Socket = io("http://localhost:4000");
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });

  const video = document.getElementById("local") as HTMLVideoElement;
  video.srcObject = stream;

  const device = new Device();

  const rtpCapabilities: RtpCapabilities = await new Promise((res) => {
    socket.emit("getRtpCapabilities", res);
  });
  await device.load({ routerRtpCapabilities: rtpCapabilities });

  const transportParams = await new Promise<any>((res) =>
    socket.emit("createTransport", res),
  );

  const transport: Transport = device.createSendTransport(transportParams);

  transport.on("connect", ({ dtlsParameters }, cb) => {
    socket.emit("connectTransport", { dtlsParameters });
    cb();
  });
  transport.on("produce", ({ kind, rtpParameters }, cb) => {
    socket.emit(
      "produce",
      { kind, rtpParameters },
      ({ id }: { id: string }) => {
        cb({ id });
      },
    );
  });
  const track = stream.getVideoTracks()[0];
  await transport.produce({ track });

  const recvParams = await new Promise<any>((res) =>
    socket.emit("createRecvTransport", res),
  );

  const recvTransport = device.createRecvTransport(recvParams);

  recvTransport.on("connect", ({ dtlsParameters }, cb) => {
    socket.emit("connectRecvTransport", { dtlsParameters });
    cb();
  });

  const consumeParams = await new Promise<any>((res) =>
    socket.emit("consume", { rtpCapabilities: device.rtpCapabilities }, res),
  );

  const consumer = await recvTransport.consume({
    id: consumeParams.id,
    producerId: consumeParams.producerId,
    kind: consumeParams.kind,
    rtpParameters: consumeParams.rtpParameters,
  });

  const remoteStream = new MediaStream();
  remoteStream.addTrack(consumer.track);

  const remoteVideo = document.getElementById("remote") as HTMLVideoElement;
  remoteVideo.srcObject = remoteStream;
}

async function consumeProducer(
  socket: any,
  device: any,
  recvTransport: any,
  producerId: string,
) {
  const params = await new Promise<any>((res) =>
    socket.emit(
      "consume",
      {
        producerId,
        rtpCapabilities: device.rtpCapabilities,
      },
      res,
    ),
  );

  const consumer = await recvTransport.consume(params);

  const stream = new MediaStream();
  stream.addTrack(consumer.track);

  const video = document.createElement("video");
  video.autoplay = true;
  video.playsInline = true;
  video.srcObject = stream;

  document.body.appendChild(video);
}
