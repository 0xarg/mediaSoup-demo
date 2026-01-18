"use client";

import { startWebRTC } from "@/lib/webrtc";

export default function Home() {
  return (
    <main>
      <button onClick={startWebRTC}>Start Camera</button>

      <div>
        <h3>Local</h3>
        <video id="local" autoPlay playsInline />
      </div>

      <div>
        <h3>Remote (Loopback)</h3>
        <video id="remote" autoPlay playsInline />
      </div>
    </main>
  );
}
