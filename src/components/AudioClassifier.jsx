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
  const INFERENCE_INTERVAL_MS = 1000; // Throttle inference to max 1 per second
  const WINDOW_SIZE = 44032; // Number of samples per ML window
  const DEVICE_ID = "2";

  const connectHardwareStream = () => {
    console.log(`[${new Date().toLocaleTimeString()}] 🔌 Connecting to live audio WebSocket: ws://localhost:8080/ws/live-audio...`);

    const ws = new WebSocket("ws://localhost:8080/ws/live-audio");
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      console.log(`[${new Date().toLocaleTimeString()}] Hardware audio stream connected! Listening for incoming PCM buffer packets...`);
      setIsConnected(true);
    };

    ws.onmessage = async (event) => {
      if (event.data instanceof ArrayBuffer) {
        // Validate Float32 byte alignment to prevent sound glitching
        if (event.data.byteLength % 4 !== 0) {
          console.warn(`[${new Date().toLocaleTimeString()}] Dropped packet: Byte length (${event.data.byteLength}) is not Float32 aligned.`);
          return;
        }

        const incomingPCM = new Float32Array(event.data);
        const currentBuffer = audioBufferRef.current;
        
        // Append incoming stream chunk to current buffer
        const nextBuffer = new Float32Array(currentBuffer.length + incomingPCM.length);
        nextBuffer.set(currentBuffer);
        nextBuffer.set(incomingPCM, currentBuffer.length);
        audioBufferRef.current = nextBuffer;

        const now = Date.now();

        // Check if buffer has reached the window size and throttle delay has passed
        if (
          audioBufferRef.current.length >= WINDOW_SIZE &&
          !isProcessingRef.current &&
          now - lastInferenceTimeRef.current >= INFERENCE_INTERVAL_MS
        ) {
          lastInferenceTimeRef.current = now;

          console.log(`[${new Date().toLocaleTimeString()}] Audio window full (${audioBufferRef.current.length} samples). Sending payload to ML server on port 5001...`);

          const len = audioBufferRef.current.length;
          const inferenceWindow = audioBufferRef.current.subarray(len - WINDOW_SIZE, len);

          // Retain overlapping samples for seamless streaming
          audioBufferRef.current = audioBufferRef.current.subarray(len - (WINDOW_SIZE / 2));

          await runInference(inferenceWindow);
        } else if (audioBufferRef.current.length > WINDOW_SIZE * 2) {
          // Prevent memory leaks if inference lags behind
          console.warn(`[${new Date().toLocaleTimeString()}] Audio buffer overflow detected! Pruning backlog...`);
          audioBufferRef.current = audioBufferRef.current.subarray(audioBufferRef.current.length - WINDOW_SIZE);
        }
      }
    };

    ws.onclose = () => {
      console.warn(`[${new Date().toLocaleTimeString()}] Hardware audio stream disconnected.`);
      setIsConnected(false);
    };

    ws.onerror = (err) => {
      console.error(`[${new Date().toLocaleTimeString()}] WebSocket Error on port 8080:`, err);
    };

    wsRef.current = ws;
  };

  const disconnectHardwareStream = () => {
    console.log(`[${new Date().toLocaleTimeString()}] Manually disconnecting hardware audio stream...`);
    if (wsRef.current) wsRef.current.close();
    audioBufferRef.current = new Float32Array(0);
    setPrediction("Idle");
    setConfidence(null);
    setIsConnected(false);
  };

  const triggerDeviceCheckIn = async (detectedClass) => {
    const now = Date.now();
    const remainingCooldown = ALERT_COOLDOWN_MS - (now - lastAlertTimeRef.current);

    if (remainingCooldown > 0) {
      console.log(`[${new Date().toLocaleTimeString()}] Alert suppressed by active cooldown (${(remainingCooldown / 1000).toFixed(1)}s remaining)`);
      return;
    }

    lastAlertTimeRef.current = now;

    try {
      console.log(`[${new Date().toLocaleTimeString()}] Target class matched! Writing check-in alert to Firestore for Device #${DEVICE_ID}...`);
      
      await setDoc(doc(db, "alerts", DEVICE_ID), {
        deviceId: Number(DEVICE_ID),
        status: "checkin",
        triggerReason: detectedClass,
        createdAt: new Date().toISOString(),
      });

      console.log(`[${new Date().toLocaleTimeString()}] SUCCESS: Firestore alert created for Device #${DEVICE_ID}!`);
    } catch (err) {
      console.error(`[${new Date().toLocaleTimeString()}] Failed to write alert to Firestore:`, err);
    }
  };

  const runInference = async (pcmWindow) => {
    isProcessingRef.current = true;
    const startTime = performance.now();

    try {
      const response = await fetch("http://localhost:5001/predict", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: pcmWindow.buffer,
      });

      const roundTripMs = (performance.now() - startTime).toFixed(1);

      if (response.ok) {
        const result = await response.json();
        console.log(`[${new Date().toLocaleTimeString()}] Inference complete (${roundTripMs}ms):`, result);

        if (result.status === "success") {
          setPrediction(result.class);
          setConfidence((result.confidence * 100).toFixed(1));

          console.log(
            `[${new Date().toLocaleTimeString()}] Detected: "${result.class}" | Confidence: ${(result.confidence * 100).toFixed(1)}%`
          );

          if (result.class.toLowerCase().includes("1 class 2")) {
            console.log(`[${new Date().toLocaleTimeString()}] Target sound detected ("1 class 2"). Initiating trigger check...`);
            await triggerDeviceCheckIn(result.class);
          }
        } else {
          console.warn(`[${new Date().toLocaleTimeString()}] ML server reported an internal failure:`, result);
        }
      } else {
        console.error(`[${new Date().toLocaleTimeString()}] ML server returned HTTP status: ${response.status}`);
      }
    } catch (err) {
      console.error(`[${new Date().toLocaleTimeString()}] Error communicating with ML server on http://localhost:5001/predict:`, err);
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
          width: "100%"
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