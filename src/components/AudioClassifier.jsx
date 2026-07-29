import React, { useState, useRef, useEffect } from "react";

export default function AudioClassifier() {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState(null);
  const [prediction, setPrediction] = useState("Idle");
  
  const wsRef = useRef(null);
  const audioBufferRef = useRef([]);

  const SAMPLE_RATE = 16000; 
  const WINDOW_SIZE = 16000; // 1s window

  const startListening = () => {
    setError(null);

    //update to esp32 ip
    wsRef.current = new WebSocket("ws://192.168.1.100:81");
    wsRef.current.binaryType = "arraybuffer";

    wsRef.current.onopen = () => {
      console.log("ESP32 connected");
      setIsListening(true);
    };

    wsRef.current.onmessage = (event) => {
      const incomingPCM = new Float32Array(event.data);

      // Append raw audio chunks
      const currentBuffer = audioBufferRef.current;
      const nextBuffer = new Float32Array(currentBuffer.length + incomingPCM.length);
      nextBuffer.set(currentBuffer);
      nextBuffer.set(incomingPCM, currentBuffer.length);
      audioBufferRef.current = nextBuffer;

      if (audioBufferRef.current.length >= WINDOW_SIZE) {
        const inferenceWindow = audioBufferRef.current.subarray(0, WINDOW_SIZE);
        runInference(inferenceWindow);

        audioBufferRef.current = audioBufferRef.current.subarray(WINDOW_SIZE / 2);
      }
    };

    wsRef.current.onerror = (err) => {
      console.error("WS error:", err);
      setError("ESP32 connection lost.");
      stopListening();
    };

    wsRef.current.onclose = () => setIsListening(false);
  };

  const runInference = (pcmWindow) => {
    try {
      console.log("Inference window size:", pcmWindow.length);
      // Hook model inference engine here
    } catch (err) {
      console.error("Inference failure:", err);
    }
  };

  const stopListening = () => {
    if (wsRef.current) wsRef.current.close();
    setIsListening(false);
  };

  useEffect(() => {
    return () => wsRef.current?.close();
  }, []);

  return (
    <div className="audio-classifier-panel" style={{ padding: "20px", border: "1px solid #ccc", borderRadius: "8px", margin: "10px 0" }}>
      <h3>Hardware Stream Monitor</h3>
      {error && <p style={{ color: "red" }}>{error}</p>}
      
      <button onClick={isListening ? stopListening : startListening}>
        {isListening ? "Disconnect ESP32" : "Connect ESP32"}
      </button>

      <div style={{ marginTop: "15px" }}>
        <p>Status: <strong>{isListening ? "Streaming Active" : "Offline"}</strong></p>
        <p>Output: <strong>{prediction}</strong></p>
      </div>
    </div>
  );
}