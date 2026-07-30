import React, { useState, useRef } from "react";

export default function AudioTest() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [status, setStatus] = useState("Idle");

  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);

  const startEmulation = async () => {
    try {
      setStatus("Connecting to ingest server...");

      const ws = new WebSocket("ws://localhost:8081/api/esp32-audio");
      ws.binaryType = "arraybuffer";

      ws.onopen = async () => {
        setStatus("Connected. Accessing microphone...");

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        streamRef.current = stream;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContext({ sampleRate: 16000 });
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(1024, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN) {
            const inputPCM = e.inputBuffer.getChannelData(0);
            const floatBuffer = new Float32Array(inputPCM);
            ws.send(floatBuffer.buffer);
          }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);

        setIsSimulating(true);
        setStatus("Transmitting microphone stream...");
      };

      ws.onclose = () => {
        stopEmulation();
        setStatus("Disconnected");
      };

      ws.onerror = () => {
        setStatus("Connection error on port 8081");
      };

      wsRef.current = ws;
    } catch (err) {
      console.error(err);
      setStatus("Microphone access denied");
    }
  };

  const stopEmulation = () => {
    if (processorRef.current) processorRef.current.disconnect();
    if (audioContextRef.current) audioContextRef.current.close();
    if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    if (wsRef.current) wsRef.current.close();

    setIsSimulating(false);
    setStatus("Idle");
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "500px", margin: "2rem auto", border: "1px solid #ccc", borderRadius: "8px" }}>
      <h2>Hardware Stream Emulator</h2>
      <button 
        onClick={isSimulating ? stopEmulation : startEmulation}
        style={{
          padding: "0.75rem 1.5rem",
          backgroundColor: isSimulating ? "#d9534f" : "#0275d8",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontWeight: "bold"
        }}
      >
        {isSimulating ? "Stop Transmission" : "Start Transmitting Mic Data"}
      </button>

      <div style={{ marginTop: "1.5rem" }}>
        <p>Status: <strong>{status}</strong></p>
      </div>
    </div>
  );
}