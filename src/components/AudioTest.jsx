import React, { useState, useRef } from "react";
import "../styles/AudioMonitor.css";

export default function AudioTest() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [status, setStatus] = useState("Idle");

  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);

  const startEmulation = async () => {
    try {
      setStatus("Connecting to audio ingest server on port 8081...");

      const host = window.location.hostname || "localhost";
      const ws = new WebSocket(`ws://${host}:8081/api/esp32-audio`);
      ws.binaryType = "arraybuffer";

      ws.onopen = async () => {
        setStatus("Connected. Requesting browser microphone access...");

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        streamRef.current = stream;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContext({ sampleRate: 16000 });
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(1024, 1, 1);
        processorRef.current = processor;

        const gainNode = audioContext.createGain();
        gainNode.gain.value = 0;

        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN) {
            const inputPCM = e.inputBuffer.getChannelData(0);
            const floatBuffer = new Float32Array(inputPCM);
            ws.send(floatBuffer.buffer);
          }
        };

        source.connect(processor);
        processor.connect(gainNode);
        gainNode.connect(audioContext.destination);

        setIsSimulating(true);
        setStatus("Transmitting microphone stream (Speakers Muted)...");
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
      console.error("Microphone emulation error:", err);
      setStatus("Microphone access denied or audio device error");
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
    <div className="audio-monitor-container">
      <div className="audio-monitor-card">
        <h2 className="audio-monitor-title">Hardware Audio Stream Emulator</h2>
        <p className="audio-monitor-subtitle">
          Captures audio from your browser microphone and streams it as Float32 PCM to Port 8081 to emulate an ESP32 hardware microphone node.
        </p>

        <button
          onClick={isSimulating ? stopEmulation : startEmulation}
          className={`audio-btn ${isSimulating ? "audio-btn-danger" : "audio-btn-primary"}`}
        >
          {isSimulating ? "Stop Transmission" : "Start Transmitting Mic Data"}
        </button>

        <div className="audio-monitor-panel">
          <div className="audio-info-row">
            <span className="audio-info-label">Status</span>
            <span className="audio-info-value">{status}</span>
          </div>
        </div>
      </div>
    </div>
  );
}