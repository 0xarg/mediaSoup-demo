"use client";

import { joinRoom } from "@/lib/webrtc";

// import { joinRoom } from "@/lib/webrtc";

export default function Page() {
  return (
    <div>
      <button onClick={() => joinRoom()}>Create Room</button>
      <button onClick={() => joinRoom(prompt("Room ID")!)}>Join Room</button>

      <video id="local" autoPlay playsInline />
      <div id="remotes" />
    </div>
  );
}
