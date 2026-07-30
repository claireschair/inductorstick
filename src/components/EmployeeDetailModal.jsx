import { useState, useEffect, useRef, useCallback } from "react";
import { useTelemetry } from "../context/TelemetryContext";
import "../styles/EmployeeDetailModal.css";

const WS_HOST = window.location.hostname || "localhost";
const WS_PORT = 8080;
const RECONNECT_DELAY = 2000;
const AUDIO_SAMPLE_RATE = 16000;

// ESP32 QVGA RGB565 frame dimensions
const FRAME_WIDTH = 320;
const FRAME_HEIGHT = 240;

function EmployeeDetailModal({ employee, onClose }) {
  const { getDeviceTelemetry } = useTelemetry();
  const liveTelemetry = getDeviceTelemetry(employee.id);

  const { firstName, lastName } = employee;

  const currentStatus = liveTelemetry?.status || employee.status || "active";

  const tempVal = liveTelemetry?.sensorData?.temperature ?? employee.sensorData?.temperature ?? "--";
  const humidityVal = liveTelemetry?.sensorData?.humidity ?? employee.sensorData?.humidity ?? "--";
  const soundVal = employee.sensorData?.sound ?? "--";

  const gyro = liveTelemetry?.gyroData || { x: null, y: null, z: null };
  const accel = liveTelemetry?.accelData || { x: null, y: null, z: null };

  const formatVector = (val) => {
    if (val === null || val === undefined) return "N/A";
    return typeof val === "number" ? val.toFixed(2) : val;
  };

  const formatLastReceived = (updatedAt) => {
    if (!updatedAt) return employee.lastCheckIn || "N/A";
    const dateObj = typeof updatedAt?.toDate === "function" ? updatedAt.toDate() : new Date(updatedAt);
    if (isNaN(dateObj.getTime())) return updatedAt || employee.lastCheckIn || "N/A";
    return dateObj.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
  };

  const audioWsRef = useRef(null);
  const audioCtxRef = useRef(null);
  const nextPlayTimeRef = useRef(0);
  const reconnectAudioRef = useRef(null);
  const mountedRef = useRef(true);

  const canvasRef = useRef(null);
  const videoWsRef = useRef(null);
  const reconnectVideoRef = useRef(null);

  const [videoStatus, setVideoStatus] = useState("connecting");
  const [audioStatus, setAudioStatus] = useState("disconnected");
  const [muted, setMuted] = useState(false);

  // Connect to server's video relay WebSocket (ESP32 → server → frontend)
  const connectVideo = useCallback(() => {
    if (!mountedRef.current) return;
    setVideoStatus("connecting");

    const wsUrl = `ws://${WS_HOST}:${WS_PORT}/ws/live-video`;
    console.log("[Video] Connecting to:", wsUrl);
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    videoWsRef.current = ws;

    ws.onopen = () => {
      console.log("[Video] ✅ WebSocket connected");
      if (mountedRef.current) setVideoStatus("connected");
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const frameData = event.data;
      const expectedBytes = FRAME_WIDTH * FRAME_HEIGHT * 2;
      
      // Log first few frames and size mismatches for debugging
      if (!ws._frameCount) ws._frameCount = 0;
      ws._frameCount++;
      if (ws._frameCount <= 5 || frameData.byteLength !== expectedBytes) {
        console.log(`[Video] Frame #${ws._frameCount}: ${frameData.byteLength} bytes (expected ${expectedBytes})`);
      }
      
      if (frameData.byteLength !== expectedBytes) return;

      const ctx = canvas.getContext("2d");
      const imageData = ctx.createImageData(FRAME_WIDTH, FRAME_HEIGHT);
      const rgba = imageData.data;
      const view = new DataView(frameData);

      for (let i = 0; i < FRAME_WIDTH * FRAME_HEIGHT; i++) {
        // OV2640 outputs big-endian RGB565: [RRRRRGGG][GGGBBBBB]
        // If colors appear swapped, change false → true for little-endian
        const pixel = view.getUint16(i * 2, false);
        const r5 = (pixel >> 11) & 0x1F;
        const g6 = (pixel >> 5) & 0x3F;
        const b5 = pixel & 0x1F;

        rgba[i * 4]     = (r5 << 3) | (r5 >> 2);
        rgba[i * 4 + 1] = (g6 << 2) | (g6 >> 4);
        rgba[i * 4 + 2] = (b5 << 3) | (b5 >> 2);
        rgba[i * 4 + 3] = 255;
      }

      ctx.putImageData(imageData, 0, 0);
    };

    ws.onclose = (event) => {
      console.log(`[Video] ❌ WebSocket closed (code: ${event.code}, reason: ${event.reason})`);
      if (!mountedRef.current) return;
      setVideoStatus("disconnected");
      reconnectVideoRef.current = setTimeout(connectVideo, RECONNECT_DELAY);
    };

    ws.onerror = (err) => {
      console.error("[Video] WebSocket error:", err);
      ws.close();
    };
  }, []);

  // Start video WebSocket immediately on mount
  useEffect(() => {
    connectVideo();

    return () => {
      clearTimeout(reconnectVideoRef.current);
      if (videoWsRef.current) {
        videoWsRef.current.onclose = null;
        videoWsRef.current.close();
      }
    };
  }, [connectVideo]);


  const connectAudio = useCallback(() => {
    if (!mountedRef.current) return;
    setAudioStatus("connecting");

    const ws = new WebSocket(`ws://${WS_HOST}:${WS_PORT}/ws/live-audio`);
    ws.binaryType = "arraybuffer";
    audioWsRef.current = ws;

    ws.onopen = () => {
      if (mountedRef.current) setAudioStatus("connected");
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current || muted) return;

      if (!audioCtxRef.current) {
        try {
          audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: AUDIO_SAMPLE_RATE,
          });
        } catch {
          return;
        }
      }

      const audioCtx = audioCtxRef.current;
      let float32;

      if (event.data.byteLength % 4 === 0) {
        float32 = new Float32Array(event.data);
      } else {
        const int16 = new Int16Array(event.data);
        float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
          float32[i] = int16[i] / 32768.0;
        }
      }

      const buffer = audioCtx.createBuffer(1, float32.length, AUDIO_SAMPLE_RATE);
      buffer.getChannelData(0).set(float32);

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);

      const now = audioCtx.currentTime;
      const startTime = Math.max(now + 0.05, nextPlayTimeRef.current);
      source.start(startTime);
      nextPlayTimeRef.current = startTime + buffer.duration;
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setAudioStatus("disconnected");
      reconnectAudioRef.current = setTimeout(connectAudio, RECONNECT_DELAY);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [muted]);

  useEffect(() => {
    mountedRef.current = true;
    connectAudio();

    return () => {
      mountedRef.current = false;

      clearTimeout(reconnectAudioRef.current);

      if (audioWsRef.current) {
        audioWsRef.current.onclose = null;
        audioWsRef.current.close();
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, []); 

  useEffect(() => {
    if (muted && audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
      nextPlayTimeRef.current = 0;
    }
  }, [muted]);

  const statusDotClass = (status) => {
    if (status === "connected") return "connection-dot dot-connected";
    if (status === "connecting") return "connection-dot dot-connecting";
    return "connection-dot dot-disconnected";
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>
              {firstName} {lastName} <span className={`status-badge status-${currentStatus}`}>
                {currentStatus}
              </span>
            </h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modal-section">
          <h3>Video Feed</h3>
          <div className="video-feed-container">
            <canvas
              ref={canvasRef}
              width={FRAME_WIDTH}
              height={FRAME_HEIGHT}
              className="video-feed-canvas"
            />
            {videoStatus !== "connected" && (
              <div className="video-feed-placeholder">
                {videoStatus === "connecting" ? "Connecting..." : "No Signal"}
              </div>
            )}
          </div>
        </div>

        <div className="modal-section">
          <p className="modal-detail-line">
            Last data received: {formatLastReceived(liveTelemetry?.updatedAt)}
          </p>
        </div>

        <div className="modal-section">
          <h3>Sensor Data</h3>
          <div className="modal-sensor-grid">
            <div className="sensor-stat">
              <span className="sensor-label">Temp</span>
              <span className="sensor-value">{tempVal}°F</span>
            </div>
            <div className="sensor-stat">
              <span className="sensor-label">Humidity</span>
              <span className="sensor-value">{humidityVal}%</span>
            </div>
            <div className="sensor-stat">
              <span className="sensor-label">Sound</span>
              <span className="sensor-value">{soundVal} dB</span>
            </div>
          </div>
        </div>

        <div className="modal-section">
          <h3>Gyroscope</h3>
          <div className="modal-sensor-grid">
            <div className="sensor-stat">
              <span className="sensor-label">X Axis</span>
              <span className="sensor-value">{formatVector(gyro.x)}</span>
            </div>
            <div className="sensor-stat">
              <span className="sensor-label">Y Axis</span>
              <span className="sensor-value">{formatVector(gyro.y)}</span>
            </div>
            <div className="sensor-stat">
              <span className="sensor-label">Z Axis</span>
              <span className="sensor-value">{formatVector(gyro.z)}</span>
            </div>
          </div>
        </div>

        <div className="modal-section">
          <h3>Accelerometer</h3>
          <div className="modal-sensor-grid">
            <div className="sensor-stat">
              <span className="sensor-label">X Axis</span>
              <span className="sensor-value">{formatVector(accel.x)}</span>
            </div>
            <div className="sensor-stat">
              <span className="sensor-label">Y Axis</span>
              <span className="sensor-value">{formatVector(accel.y)}</span>
            </div>
            <div className="sensor-stat">
              <span className="sensor-label">Z Axis</span>
              <span className="sensor-value">{formatVector(accel.z)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmployeeDetailModal;