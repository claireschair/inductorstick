import React, { useState, useEffect, useRef } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function AudioClassifier() {
  const [isConnected, setIsConnected] = useState(false);
  const [prediction, setPrediction] = useState("Idle");
  const [confidence, setConfidence] = useState(null);
  const [currentDecibels, setCurrentDecibels] = useState(0);

  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);
  const wsRef = useRef(null);

  const audioBufferRef = useRef(new Float32Array(0));
  const isProcessingRef = useRef(false);
  const lastInferenceTimeRef = useRef(0);
  const lastAlertTimeRef = useRef(0);
  const lastDecibelSendRef = useRef(0);

  const ALERT_COOLDOWN_MS = 10000;
  const INFERENCE_INTERVAL_MS = 1000;
  const WINDOW_SIZE = 44032;
  const DEVICE_ID = "2";

  const calculateDecibels = (pcmData) => {
    let sumSquares = 0;
    for (let i = 0; i < pcmData.length; i++) {
      sumSquares += pcmData[i] * pcmData[i];
    }
    const rms = Math.sqrt(sumSquares / pcmData.length);
    const dbVal = Math.round(20 * Math.log10(rms + 1e-6) + 95);
    return Math.min(115, Math.max(30, dbVal));
  };

  const sendDecibelsToServer = async (dbVal) => {
    const now = Date.now();
    if (now - lastDecibelSendRef.current < 400) return;
    lastDecibelSendRef.current = now;

    try {
      const host = window.location.hostname || "localhost";
      await fetch(`http://${host}:8080/api/mic-decibels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: DEVICE_ID, decibels: dbVal }),
      });
    } catch (err) {
      // silent background stream catch
    }
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
      console.log(`[${new Date().toLocaleTimeString()}] Target explosion sound matched! Triggering Nano check-in & writing alert for Device #${DEVICE_ID}...`);

      const host = window.location.hostname || "localhost";
      await fetch(`http://${host}:8080/api/trigger-checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: DEVICE_ID, reason: detectedClass }),
      });

      await setDoc(doc(db, "alerts", DEVICE_ID), {
        deviceId: Number(DEVICE_ID),
        status: "checkin",
        triggerReason: detectedClass,
        createdAt: new Date().toISOString(),
      });

      console.log(`[${new Date().toLocaleTimeString()}] SUCCESS: Firestore check-in alert created for Device #${DEVICE_ID}!`);
    } catch (err) {
      console.error(`[${new Date().toLocaleTimeString()}] Failed to write alert:`, err);
    }
  };

  const runInference = async (pcmWindow) => {
    isProcessingRef.current = true;
    const startTime = performance.now();

    try {
      const host = window.location.hostname || "localhost";
      const response = await fetch(`http://${host}:5001/predict`, {
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

          const lowerClass = result.class.toLowerCase();
          if (lowerClass.includes("1 class 2") || lowerClass.includes("explosion") || lowerClass.includes("blast")) {
            console.log(`[${new Date().toLocaleTimeString()}] Explosion detection confirmed! Initiating Nano check-in...`);
            await triggerDeviceCheckIn(result.class);
          }
        }
      }
    } catch (err) {
      const host = window.location.hostname || "localhost";
      console.error(`[${new Date().toLocaleTimeString()}] Error communicating with ML server on http://${host}:5001/predict:`, err);
    } finally {
      isProcessingRef.current = false;
    }
  };

  const startAudioIngest = async () => {
    try {
      const host = window.location.hostname || "localhost";
      console.log(`[${new Date().toLocaleTimeString()}] Initializing microphone audio sensor stream...`);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;

      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 0;

      processor.onaudioprocess = async (e) => {
        const inputPCM = e.inputBuffer.getChannelData(0);
        const floatBuffer = new Float32Array(inputPCM);

        // 1. Calculate and transmit decibel readings
        const dbVal = calculateDecibels(floatBuffer);
        setCurrentDecibels(dbVal);
        sendDecibelsToServer(dbVal);

        // 2. Accumulate buffer for ML inference window
        const currentBuffer = audioBufferRef.current;
        const nextBuffer = new Float32Array(currentBuffer.length + floatBuffer.length);
        nextBuffer.set(currentBuffer);
        nextBuffer.set(floatBuffer, currentBuffer.length);
        audioBufferRef.current = nextBuffer;

        const now = Date.now();
        if (
          audioBufferRef.current.length >= WINDOW_SIZE &&
          !isProcessingRef.current &&
          now - lastInferenceTimeRef.current >= INFERENCE_INTERVAL_MS
        ) {
          lastInferenceTimeRef.current = now;
          const len = audioBufferRef.current.length;
          const inferenceWindow = audioBufferRef.current.subarray(len - WINDOW_SIZE, len);
          audioBufferRef.current = audioBufferRef.current.subarray(len - (WINDOW_SIZE / 2));
          await runInference(inferenceWindow);
        } else if (audioBufferRef.current.length > WINDOW_SIZE * 2) {
          audioBufferRef.current = audioBufferRef.current.subarray(audioBufferRef.current.length - WINDOW_SIZE);
        }

        // 3. Send over WS to live audio server if active
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(floatBuffer.buffer);
        }
      };

      source.connect(processor);
      processor.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      try {
        const ws = new WebSocket(`ws://${host}:8081/api/esp32-audio`);
        ws.binaryType = "arraybuffer";
        wsRef.current = ws;
      } catch (wsErr) {
        console.warn("Audio Ingest WS fallback mode:", wsErr.message);
      }

      setIsConnected(true);
    } catch (err) {
      console.error("Microphone Ingest Access Error:", err);
      setIsConnected(false);
    }
  };

  const stopAudioIngest = () => {
    console.log(`[${new Date().toLocaleTimeString()}] Stopping microphone audio sensor stream...`);
    if (processorRef.current) processorRef.current.disconnect();
    if (audioContextRef.current) audioContextRef.current.close();
    if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    if (wsRef.current) wsRef.current.close();

    audioBufferRef.current = new Float32Array(0);
    setIsConnected(false);
    setPrediction("Idle");
    setConfidence(null);
    setCurrentDecibels(0);
  };

  useEffect(() => {
    startAudioIngest();
    return () => {
      stopAudioIngest();
    };
  }, []);

  return (
    <div style={{ padding: "2rem", maxWidth: "520px", margin: "2rem auto", border: "1px solid #333", borderRadius: "10px", backgroundColor: "#121212", color: "#fff", fontFamily: "sans-serif" }}>
      <h2 style={{ margin: "0 0 1rem 0", fontSize: "1.35rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span>🎙️</span> Device Audio Ingest & Explosion Classifier
      </h2>
      <p style={{ fontSize: "0.85rem", color: "#aaa", marginBottom: "1.5rem" }}>
        Active microphone sensor feeding sound decibels to Nano LCD display and running real-time AI explosion detection.
      </p>

      <button
        onClick={isConnected ? stopAudioIngest : startAudioIngest}
        style={{
          padding: "0.75rem 1.5rem",
          backgroundColor: isConnected ? "#d9534f" : "#0275d8",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontWeight: "bold",
          width: "100%",
          fontSize: "0.95rem"
        }}
      >
        {isConnected ? "Disable Microphone Stream" : "Enable Microphone Stream"}
      </button>

      <div style={{ marginTop: "1.5rem", backgroundColor: "#1e1e1e", padding: "1rem", borderRadius: "8px" }}>
        <p style={{ margin: "0.4rem 0" }}>Status: <strong style={{ color: isConnected ? "#4caf50" : "#ff9800" }}>{isConnected ? "Microphone Ingest Active" : "Offline"}</strong></p>

        <div style={{ margin: "0.8rem 0" }}>
          <p style={{ margin: "0 0 0.4rem 0", fontSize: "0.9rem" }}>Sound Level: <strong>{currentDecibels} dB</strong></p>
          <div style={{ width: "100%", height: "10px", backgroundColor: "#333", borderRadius: "5px", overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.min(100, Math.max(0, (currentDecibels - 30) * 1.25))}%`,
                height: "100%",
                backgroundColor: currentDecibels > 85 ? "#f44336" : currentDecibels > 70 ? "#ff9800" : "#4caf50",
                transition: "width 0.15s ease"
              }}
            />
          </div>
        </div>

        <p style={{ margin: "0.4rem 0" }}>Detected Classification: <strong>{prediction}</strong></p>
        {confidence && <p style={{ margin: "0.4rem 0" }}>Confidence Score: <strong>{confidence}%</strong></p>}
      </div>
    </div>
  );
}