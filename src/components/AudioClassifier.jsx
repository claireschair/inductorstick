import React, { useState, useEffect, useRef } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function AudioClassifier() {
  const [isConnected, setIsConnected] = useState(false);
  const [prediction, setPrediction] = useState("Idle");
  const [confidence, setConfidence] = useState(null);

  const wsRef = useRef(null);
  const audioBufferRef = useRef(new Float32Array(0));
  const isProcessingRef = useRef(false);
  const lastInferenceTimeRef = useRef(0);
  const lastAlertTimeRef = useRef(0);

  const ALERT_COOLDOWN_MS = 10000;
  const INFERENCE_INTERVAL_MS = 1000; // Throttle: Only send to ML every 1 second
  const WINDOW_SIZE = 44032;
  const DEVICE_ID = "2";

  const connectHardwareStream = () => {
    console.log("Connecting to hardware audio stream on port 8080...");
    const ws = new WebSocket("ws://localhost:8080/ws/live-audio");
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      console.log("Hardware stream connected successfully.");
      setIsConnected(true);
    };

    ws.onmessage = async (event) => {
      if (event.data instanceof ArrayBuffer) {
        // Ensure incoming buffer byte length is a multiple of 4 (Float32) to prevent corruption noise
        if (event.data.byteLength % 4 !== 0) return;

        const incomingPCM = new Float32Array(event.data);
        const currentBuffer = audioBufferRef.current;
        const nextBuffer = new Float32Array(currentBuffer.length + incomingPCM.length);
        nextBuffer.set(currentBuffer);
        nextBuffer.set(incomingPCM, currentBuffer.length);
        audioBufferRef.current = nextBuffer;

        const now = Date.now();

        // Check if buffer is ready AND enough time has passed since last inference
        if (
          audioBufferRef.current.length >= WINDOW_SIZE &&
          !isProcessingRef.current &&
          now - lastInferenceTimeRef.current >= INFERENCE_INTERVAL_MS
        ) {
          lastInferenceTimeRef.current = now;

          const len = audioBufferRef.current.length;
          const inferenceWindow = audioBufferRef.current.subarray(len - WINDOW_SIZE, len);

          // Keep only the most recent half window to prevent infinite buffer growth
          audioBufferRef.current = audioBufferRef.current.subarray(len - (WINDOW_SIZE / 2));

          await runInference(inferenceWindow);
        } else if (audioBufferRef.current.length > WINDOW_SIZE * 2) {
          // Prevent memory leaks / buffer bloat if inference is lagging behind
          audioBufferRef.current = audioBufferRef.current.subarray(audioBufferRef.current.length - WINDOW_SIZE);
        }
      }
    };

    ws.onclose = () => {
      console.log("Hardware stream disconnected.");
      setIsConnected(false);
    };

    wsRef.current = ws;
  };

  const disconnectHardwareStream = () => {
    if (wsRef.current) wsRef.current.close();
    audioBufferRef.current = new Float32Array(0);
    setPrediction("Idle");
    setConfidence(null);
    setIsConnected(false);
  };

  const triggerDeviceCheckIn = async (detectedClass) => {
    const now = Date.now();
    if (now - lastAlertTimeRef.current < ALERT_COOLDOWN_MS) return;
    lastAlertTimeRef.current = now;

    try {
      await setDoc(doc(db, "alerts", DEVICE_ID), {
        deviceId: Number(DEVICE_ID),
        status: "checkin",
        triggerReason: detectedClass,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Error creating Firestore alert:", err);
    }
  };

  const runInference = async (pcmWindow) => {
    isProcessingRef.current = true;
    try {
      const response = await fetch("http://localhost:5001/predict", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: pcmWindow.buffer,
      });

      if (response.ok) {
        const result = await response.json();
        if (result.status === "success") {
          setPrediction(result.class);
          setConfidence((result.confidence * 100).toFixed(1));

          if (result.class.toLowerCase().includes("1 class 2")) {
            await triggerDeviceCheckIn(result.class);
          }
        }
      }
    } catch (err) {
      console.error("Error communicating with ML server on port 5001:", err);
    } finally {
      isProcessingRef.current = false;
    }
  };

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  return (
    <div style={{ padding: "2rem", maxWidth: "500px", margin: "2rem auto", border: "1px solid #ccc", borderRadius: "8px" }}>
      <h2>Hardware Audio Stream Monitor</h2>
      <button
        onClick={isConnected ? disconnectHardwareStream : connectHardwareStream}
        style={{
          padding: "0.75rem 1.5rem",
          backgroundColor: isConnected ? "#d9534f" : "#0275d8",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontWeight: "bold",
          width: "100%",
        }}
      >
        {isConnected ? "Disconnect Stream" : "Connect Hardware Stream"}
      </button>

      <div style={{ marginTop: "1.5rem" }}>
        <p>Status: <strong>{isConnected ? "Live Stream Active" : "Offline"}</strong></p>
        <p>Detected Sound: <strong>{prediction}</strong></p>
        {confidence && <p>Confidence: <strong>{confidence}%</strong></p>}
      </div>
    </div>
  );
}