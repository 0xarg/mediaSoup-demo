import { Device } from "mediasoup-client";
import { io } from "socket.io-client";

let remoteCounter = 1;

export async function start(roomId: string) {
  const socket = io("http://192.168.31.209:4000");

  const { rtpCapabilities } = await new Promise<any>((res) =>
    socket.emit("join-room", { roomId }, res),
  );

  const device = new Device();
  await device.load({ routerRtpCapabilities: rtpCapabilities });

  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  (document.getElementById("local") as HTMLVideoElement).srcObject = stream;

  // SEND
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

  await sendTransport.produce({ track: stream.getVideoTracks()[0] });

  // RECV
  const recvParams = await new Promise<any>((res) =>
    socket.emit("create-recv-transport", res),
  );

  const recvTransport = device.createRecvTransport(recvParams);

  recvTransport.on("connect", ({ dtlsParameters }, cb) => {
    socket.emit("connect-recv-transport", { dtlsParameters });
    cb();
  });

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
    label.innerText = `Remote Camera #${remoteCounter++}`;

    const wrapper = document.createElement("div");
    wrapper.appendChild(label);
    wrapper.appendChild(video);

    document.getElementById("remotes")!.appendChild(wrapper);
  });
}
