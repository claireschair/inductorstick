import { useState, useEffect, useRef, useCallback } from "react";
import { useTelemetry } from "../context/TelemetryContext";
import "../styles/EmployeeDetailModal.css";

const WS_HOST = window.location.hostname || "localhost";
const WS_PORT = 8080;
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

  const audioWsRef = useRef(null);
  const audioCtxRef = useRef(null);
  const nextPlayTimeRef = useRef(0);
  const reconnectAudioRef = useRef(null);
  const mountedRef = useRef(true);

  const [videoStatus, setVideoStatus] = useState("connecting");
  const [audioStatus, setAudioStatus] = useState("disconnected");
  const [muted, setMuted] = useState(false);
  const [esp32Ip, setEsp32Ip] = useState(null);
  const [mjpegUrl, setMjpegUrl] = useState(null);
  
  const canvasRef = useRef(null);

  const drawRGB565 = useCallback((frameData) => {
    if (!canvasRef.current) return;
    let width = 0;
    let height = 0;
    
    // Auto-detect resolution based on frame length
    if (frameData.length === 640 * 480 * 2) {
      width = 640; height = 480;
    } else if (frameData.length === 320 * 240 * 2) {
      width = 320; height = 240;
    } else if (frameData.length === 160 * 120 * 2) {
      width = 160; height = 120;
    } else {
      // Guess dimensions if unknown
      const totalPixels = frameData.length / 2;
      width = Math.floor(Math.sqrt(totalPixels * (4/3)));
      height = Math.floor(width * 0.75);
    }

    if (width === 0 || height === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    let j = 0;
    for (let i = 0; i < frameData.length; i += 2) {
      // High byte first (ESP32 standard)
      const rgb = (frameData[i] << 8) | frameData[i+1];
      
      const r = (rgb >> 11) & 0x1F;
      const g = (rgb >> 5) & 0x3F;
      const b = rgb & 0x1F;

      data[j++] = (r << 3) | (r >> 2);
      data[j++] = (g << 2) | (g >> 4);
      data[j++] = (b << 3) | (b >> 2);
      data[j++] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
  }, []);

  // Fetch ESP32 IP from server, then point at its stream
  useEffect(() => {
    fetch(`http://${WS_HOST}:${WS_PORT}/api/esp32-info`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ip) {
          setEsp32Ip(data.ip);
          // Point directly at the ESP32's own stream
          setMjpegUrl(`http://${data.ip}/stream`);
        } else {
          setVideoStatus("disconnected");
        }
      })
      .catch(() => {
        setVideoStatus("disconnected");
      });
  }, []);

  useEffect(() => {
    if (!mjpegUrl) return;

    let active = true;
    const controller = new AbortController();

    async function fetchStream() {
      try {
        setVideoStatus("connecting");
        let urlToFetch = mjpegUrl;
        let response;
        
        try {
          response = await fetch(urlToFetch, { signal: controller.signal });
          if (!response.ok) throw new Error("HTTP error");
        } catch (e) {
          if (e.name === 'AbortError') throw e;
          // Fallback to proxy if direct fetch fails (CORS, network error)
          if (esp32Ip && !urlToFetch.includes("video-proxy")) {
            urlToFetch = `http://${WS_HOST}:${WS_PORT}/api/video-proxy?ip=${esp32Ip}`;
            response = await fetch(urlToFetch, { signal: controller.signal });
          } else {
            throw e;
          }
        }

        if (!response.body) {
           setVideoStatus("disconnected");
           return;
        }

        const reader = response.body.getReader();
        let chunks = [];
        let totalLength = 0;

        const boundary = "\r\n--Insert_Picture_Of_Ainsely_Giggling_Here\r\n";
        const encoder = new TextEncoder();
        const boundaryBytes = encoder.encode(boundary);

        const getBuffer = () => {
           const buf = new Uint8Array(totalLength);
           let offset = 0;
           for (const chunk of chunks) {
              buf.set(chunk, offset);
              offset += chunk.length;
           }
           return buf;
        };

        const indexOf = (arr, search, start = 0) => {
            if (search.length === 0) return -1;
            const first = search[0];
            const max = arr.length - search.length;
            for (let i = start; i <= max; i++) {
                if (arr[i] === first) {
                    let found = true;
                    for (let j = 1; j < search.length; j++) {
                        if (arr[i + j] !== search[j]) {
                            found = false;
                            break;
                        }
                    }
                    if (found) return i;
                }
            }
            return -1;
        };

        setVideoStatus("connected");

        while (active) {
          const { value, done } = await reader.read();
          if (done) break;

          chunks.push(value);
          totalLength += value.length;

          let buffer = getBuffer();
          let processedBytes = 0;

          while (true) {
             const boundaryIdx = indexOf(buffer, boundaryBytes, processedBytes);
             if (boundaryIdx === -1) break;

             const headerEndIdx = indexOf(buffer, encoder.encode("\r\n\r\n"), boundaryIdx);
             if (headerEndIdx === -1) break;

             const headersBlock = buffer.slice(boundaryIdx + boundaryBytes.length, headerEndIdx);
             const headersText = new TextDecoder().decode(headersBlock);
             const contentLengthMatch = headersText.match(/Content-Length:\s*(\d+)/i);

             if (!contentLengthMatch) {
                 processedBytes = boundaryIdx + boundaryBytes.length;
                 continue;
             }

             const contentLength = parseInt(contentLengthMatch[1], 10);
             const frameStart = headerEndIdx + 4;
             const frameEnd = frameStart + contentLength;

             if (buffer.length < frameEnd) {
                 break; 
             }

             const frameData = buffer.slice(frameStart, frameEnd);
             drawRGB565(frameData);

             processedBytes = frameEnd;
          }

          if (processedBytes > 0) {
             const remaining = buffer.slice(processedBytes);
             chunks = [remaining];
             totalLength = remaining.length;
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error("Stream error:", err);
          setVideoStatus("disconnected");
        }
      }
    }
    
    fetchStream();
    
    return () => {
      active = false;
      controller.abort();
    };
  }, [mjpegUrl, esp32Ip, drawRGB565]);


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
              className="video-feed-canvas"
              style={{ width: "100%", height: "auto", display: videoStatus === "connected" ? "block" : "none" }}
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