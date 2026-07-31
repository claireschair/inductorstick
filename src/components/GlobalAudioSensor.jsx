import React, { useEffect, useRef, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function GlobalAudioSensor() {
  const [isActive, setIsActive] = useState(false);
  const [currentDb, setCurrentDb] = useState(0);
  const [detectedSound, setDetectedSound] = useState("Idle");

  const audioCtxRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);
  const audioBufferRef = useRef(new Float32Array(0));
  const isProcessingRef = useRef(false);
  const lastInferenceRef = useRef(0);
  const lastAlertRef = useRef(0);
  const lastDbSendRef = useRef(0);
  const recentDbRef = useRef([]);

  const ALERT_COOLDOWN_MS = 8000;
  const WINDOW_SIZE = 44032;
  const DEVICE_ID = "2";

  const calculateDecibels = (pcmData) => {
    let sumSquares = 0;
    for (let i = 0; i < pcmData.length; i++) {
      sumSquares += pcmData[i] * pcmData[i];
    }
    const rms = Math.sqrt(sumSquares / pcmData.length);
    const dbVal = Math.round(20 * Math.log10(rms + 1e-6) + 102);
    const clampedInstant = Math.min(120, Math.max(35, dbVal));

    // Maintain rolling window over last ~1.5 seconds to prevent missing peaks between sampling intervals
    recentDbRef.current.push(clampedInstant);
    if (recentDbRef.current.length > 12) {
      recentDbRef.current.shift();
    }

    return Math.max(...recentDbRef.current);
  };

  const sendDecibelsToServer = async (dbVal) => {
    const now = Date.now();
    if (now - lastDbSendRef.current < 1500) return;
    lastDbSendRef.current = now;

    try {
      const host = window.location.hostname || "localhost";
      await fetch(`http://${host}:8080/api/mic-decibels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: DEVICE_ID, decibels: dbVal }),
      });
    } catch (err) {
      // Ignore background fetch errors
    }
  };

  const triggerDeviceCheckIn = async (reason) => {
    const now = Date.now();
    if (now - lastAlertRef.current < ALERT_COOLDOWN_MS) return;
    lastAlertRef.current = now;

    console.log(`[AUDIO SENSOR] 🚨 Explosion/Sound Alert Triggered! Reason: ${reason}`);

    try {
      const host = window.location.hostname || "localhost";
      await fetch(`http://${host}:8080/api/trigger-checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: DEVICE_ID, reason }),
      });

      await setDoc(doc(db, "alerts", DEVICE_ID), {
        deviceId: Number(DEVICE_ID),
        status: "checkin",
        triggerReason: reason,
        createdAt: new Date().toISOString(),
      });

      console.log(`[AUDIO SENSOR] SUCCESS: Trigger check-in alert sent for Device #${DEVICE_ID}`);
    } catch (err) {
      console.error("[AUDIO SENSOR] Alert trigger error:", err);
    }
  };

  const runMLInference = async (pcmWindow) => {
    isProcessingRef.current = true;
    try {
      const host = window.location.hostname || "localhost";
      const response = await fetch(`http://${host}:5001/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: pcmWindow.buffer,
      });

      if (response.ok) {
        const result = await response.json();
        if (result.status === "success") {
          setDetectedSound(result.class);
          const lower = (result.class || "").toLowerCase();
          if (lower.includes("1 class 2") || lower.includes("explosion") || lower.includes("blast")) {
            await triggerDeviceCheckIn(`AI Classified: ${result.class}`);
          }
        }
      }
    } catch (err) {
      // Fallback: ML server offline or unreachable
    } finally {
      isProcessingRef.current = false;
    }
  };

  const startMicIngest = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;

      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 0; // Mute playback output to prevent feedback loop

      processor.onaudioprocess = async (e) => {
        const inputPCM = e.inputBuffer.getChannelData(0);
        const floatBuffer = new Float32Array(inputPCM);

        // 1. Calculate and transmit real-time decibels
        const dbVal = calculateDecibels(floatBuffer);
        setCurrentDb(dbVal);
        sendDecibelsToServer(dbVal);

        // 2. High decibel peak trigger (> 88 dB is a loud yell/explosion spike)
        if (dbVal >= 88) {
          triggerDeviceCheckIn(`Loud Audio Peak Detected (${dbVal} dB)`);
        }

        // 3. Accumulate audio samples for ML Explosion Classifier
        const currentBuffer = audioBufferRef.current;
        const nextBuffer = new Float32Array(currentBuffer.length + floatBuffer.length);
        nextBuffer.set(currentBuffer);
        nextBuffer.set(floatBuffer, currentBuffer.length);
        audioBufferRef.current = nextBuffer;

        const now = Date.now();
        if (
          audioBufferRef.current.length >= WINDOW_SIZE &&
          !isProcessingRef.current &&
          now - lastInferenceRef.current >= 1000
        ) {
          lastInferenceRef.current = now;
          const len = audioBufferRef.current.length;
          const windowToProcess = audioBufferRef.current.subarray(len - WINDOW_SIZE, len);
          audioBufferRef.current = audioBufferRef.current.subarray(len - (WINDOW_SIZE / 2));
          await runMLInference(windowToProcess);
        } else if (audioBufferRef.current.length > WINDOW_SIZE * 2) {
          audioBufferRef.current = audioBufferRef.current.subarray(audioBufferRef.current.length - WINDOW_SIZE);
        }
      };

      source.connect(processor);
      processor.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      setIsActive(true);
      console.log("[AUDIO SENSOR] Microphone Ingest Active & Streaming.");
    } catch (err) {
      console.error("[AUDIO SENSOR] Microphone access error:", err);
      setIsActive(false);
    }
  };

  const stopMicIngest = () => {
    if (processorRef.current) processorRef.current.disconnect();
    if (audioCtxRef.current) audioCtxRef.current.close();
    if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    setIsActive(false);
  };

  useEffect(() => {
    startMicIngest();
    return () => stopMicIngest();
  }, []);

  // Headless global audio sensor running in background without UI overlay
  return null;
}
