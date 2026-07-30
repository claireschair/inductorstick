import React, { useState, useRef, useEffect } from "react";

export default function AudioClassifier() {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState(null);
  const [prediction, setPrediction] = useState("Idle");
  
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);
  const audioBufferRef = useRef([]);

  const SAMPLE_RATE = 16000;
  const WINDOW_SIZE = 16000; // 1s window

  const startListening = async () => {
    setError(null);
    audioBufferRef.current = [];

    try {
      // Grab local microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      // Set up web audio pipeline downsampled to 16kHz
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      
      // Create a standard script processor node (4096 buffer size, 1 input channel)
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const incomingPCM = e.inputBuffer.getChannelData(0); // Float32Array

        // Append to rolling buffer
        const currentBuffer = audioBufferRef.current;
        const nextBuffer = new Float32Array(currentBuffer.length + incomingPCM.length);
        nextBuffer.set(currentBuffer);
        nextBuffer.set(incomingPCM, currentBuffer.length);
        audioBufferRef.current = nextBuffer;

        // Process window when full
        if (audioBufferRef.current.length >= WINDOW_SIZE) {
          const inferenceWindow = audioBufferRef.current.subarray(0, WINDOW_SIZE);
          runInference(inferenceWindow);

          // 50% stride overlay
          audioBufferRef.current = audioBufferRef.current.subarray(WINDOW_SIZE / 2);
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
      setIsListening(true);
      console.log("Local mic stream active at 16kHz");

    } catch (err) {
      console.error("Mic access error:", err);
      setError("Microphone access denied or unsupported.");
      stopListening();
    }
  };

  const runInference = (pcmWindow) => {
    try {
      console.log("Inference window size:", pcmWindow.length);
      // Hook model inference engine here later
    } catch (err) {
      console.error("Inference failure:", err);
    }
  };

  const stopListening = () => {
    if (processorRef.current) processorRef.current.disconnect();
    if (audioContextRef.current) audioContextRef.current.close();
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    
    setIsListening(false);
  };

  useEffect(() => {
    return () => {
      if (processorRef.current) processorRef.current.disconnect();
      if (audioContextRef.current) audioContextRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    };
  }, []);

  return (
    <div className="audio-classifier-panel" style={{ padding: "20px", border: "1px solid #ccc", borderRadius: "8px", margin: "10px 0" }}>
      <h3>Local Mic Stream Monitor</h3>
      {error && <p style={{ color: "red" }}>{error}</p>}
      
      <button onClick={isListening ? stopListening : startListening}>
        {isListening ? "Stop Microphone" : "Use Local Microphone"}
      </button>

      <div style={{ marginTop: "15px" }}>
        <p>Status: <strong>{isListening ? "Listening Active" : "Offline"}</strong></p>
        <p>Output: <strong>{prediction}</strong></p>
      </div>
    </div>
  );
}