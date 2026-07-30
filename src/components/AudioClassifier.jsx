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
  const lastAlertTimeRef = useRef(0);

  const ALERT_COOLDOWN_MS = 10000;
  const WINDOW_SIZE = 44032;
  const DEVICE_ID = "2";

  const connectHardwareStream = () => {
    console.log("Attempting to connect to hardware stream...");
    const ws = new WebSocket("ws://localhost:8080/ws/live-audio");
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      console.log("Hardware stream connected successfully.");
      setIsConnected(true);
    };

    ws.onmessage = async (event) => {
      if (event.data instanceof ArrayBuffer) {
        const incomingPCM = new Float32Array(event.data);
        const currentBuffer = audioBufferRef.current;
        const nextBuffer = new Float32Array(currentBuffer.length + incomingPCM.length);
        nextBuffer.set(currentBuffer);
        nextBuffer.set(incomingPCM, currentBuffer.length);
        audioBufferRef.current = nextBuffer;

        if (audioBufferRef.current.length >= WINDOW_SIZE && !isProcessingRef.current) {
          console.log("Audio window filled. Sending to ML model...");
          const len = audioBufferRef.current.length;
          const inferenceWindow = audioBufferRef.current.subarray(len - WINDOW_SIZE, len);
          audioBufferRef.current = audioBufferRef.current.subarray(len - (WINDOW_SIZE / 2));
          await runInference(inferenceWindow);
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
    console.log("Manually disconnecting hardware stream...");
    if (wsRef.current) wsRef.current.close();
    audioBufferRef.current = new Float32Array(0);
    setPrediction("Idle");
    setConfidence(null);
  };

  const triggerDeviceCheckIn = async (detectedClass) => {
    const now = Date.now();
    
    if (now - lastAlertTimeRef.current < ALERT_COOLDOWN_MS) {
      console.log(`Alert ignored due to cooldown (${((ALERT_COOLDOWN_MS - (now - lastAlertTimeRef.current)) / 1000).toFixed(1)}s remaining)`);
      return;
    }

    lastAlertTimeRef.current = now;

    try {
      console.log(`Writing alert to Firestore for Device #${DEVICE_ID}...`);
      await setDoc(doc(db, "alerts", DEVICE_ID), {
        deviceId: Number(DEVICE_ID),
        status: "checkin",
        triggerReason: detectedClass,
        createdAt: new Date().toISOString(),
      });
      console.log(`SUCCESS: Alert 'checkin' triggered due to ${detectedClass}`);
    } catch (err) {
      console.error("Error creating Firestore alert:", err);
    }
  };

  const runInference = async (pcmWindow) => {
    isProcessingRef.current = true;
    try {
      const response = await fetch("http://localhost:5000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: pcmWindow.buffer,
      });

      if (response.ok) {
        const result = await response.json();
        console.log("Prediction result:", result);

        if (result.status === "success") {
          setPrediction(result.class);
          setConfidence((result.confidence * 100).toFixed(1));

          if (result.class.toLowerCase().includes("1 class 2")) {
            console.log("Target class detected! Initiating check-in sequence...");
            await triggerDeviceCheckIn(result.class);
          }
        }
      } else {
        console.warn("ML Server returned a non-OK response:", response.status);
      }
    } catch (err) {
      console.error("Error communicating with ML server:", err);
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
          fontWeight: "bold"
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