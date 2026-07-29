import { useState, useEffect, useRef, useCallback } from "react";
import { useTelemetry } from "../context/TelemetryContext";
import "../styles/EmployeeDetailModal.css";

const WS_HOST = window.location.hostname || "localhost";
const WS_PORT = 6767;
const RECONNECT_DELAY = 2000;
const AUDIO_SAMPLE_RATE = 16000;

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

  const canvasRef = useRef(null);
  const videoWsRef = useRef(null);
  const audioWsRef = useRef(null);
  const audioCtxRef = useRef(null);
  const nextPlayTimeRef = useRef(0);
  const reconnectVideoRef = useRef(null);
  const reconnectAudioRef = useRef(null);
  const mountedRef = useRef(true);

  const [videoStatus, setVideoStatus] = useState("connecting");
  const [audioStatus, setAudioStatus] = useState("disconnected");
  const [muted, setMuted] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);
  const [esp32Ip, setEsp32Ip] = useState(null);
  const [mjpegUrl, setMjpegUrl] = useState(null);

  useEffect(() => {
    fetch(`http://${WS_HOST}:${WS_PORT}/api/esp32-info`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ip) {
          setEsp32Ip(data.ip);
          setMjpegUrl(`http://${WS_HOST}:${WS_PORT}/api/video-proxy?ip=${data.ip}`);
        } else {
          setMjpegUrl(`http://${WS_HOST}:${WS_PORT}/api/video-proxy`);
        }
      })
      .catch(() => {
        setMjpegUrl(`http://${WS_HOST}:${WS_PORT}/api/video-proxy`);
      });
  }, []);

  const connectVideo = useCallback(() => {
    if (!mountedRef.current) return;

    const ws = new WebSocket(`ws://${WS_HOST}:${WS_PORT}/ws/live-video`);
    ws.binaryType = "arraybuffer";
    videoWsRef.current = ws;

    ws.onopen = () => {
      if (mountedRef.current && !mjpegUrl) setVideoStatus("connected");
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      const blob = new Blob([event.data], { type: "image/jpeg" });
      createImageBitmap(blob).then((bitmap) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
        }
        const ctx = canvas.getContext("2d");
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
        if (!hasFrame) setHasFrame(true);
        setVideoStatus("connected");
      }).catch(() => {});
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      if (!mjpegUrl) setVideoStatus("disconnected");
      reconnectVideoRef.current = setTimeout(connectVideo, RECONNECT_DELAY);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [hasFrame, mjpegUrl]);

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
    connectVideo();
    connectAudio();

    return () => {
      mountedRef.current = false;

      clearTimeout(reconnectVideoRef.current);
      clearTimeout(reconnectAudioRef.current);

      if (videoWsRef.current) {
        videoWsRef.current.onclose = null;
        videoWsRef.current.close();
      }
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
            {mjpegUrl ? (
              <img
                src={mjpegUrl}
                alt="ESP32 Live Stream"
                className="video-feed-canvas"
                onLoad={() => {
                  setVideoStatus("connected");
                  setHasFrame(true);
                }}
                onError={() => {
                  if (esp32Ip && !mjpegUrl.includes(esp32Ip + "/stream")) {
                    // Proxy failed — try connecting directly to ESP32's MJPEG stream
                    setMjpegUrl(`http://${esp32Ip}/stream`);
                  } else {
                    setMjpegUrl(null);
                    setVideoStatus("disconnected");
                  }
                }}
              />
            ) : (
              <canvas ref={canvasRef} className="video-feed-canvas" />
            )}
            {!hasFrame && !mjpegUrl && (
              <div className="video-feed-placeholder">
                {videoStatus === "connected" ? "NO VIDEO YET" : videoStatus === "connecting" ? "Connecting..." : "No Signal"}
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