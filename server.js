import http from "http";
import { URL } from "url";
import { WebSocketServer } from "ws";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, onSnapshot, collection } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDGOR3kDdKOXmOX9Zif09-ZPzoBRDAcSnI",
  authDomain: "inductor-stick.firebaseapp.com",
  projectId: "inductor-stick",
  storageBucket: "inductor-stick.firebasestorage.app",
  messagingSenderId: "337540028796",
  appId: "1:337540028796:web:4a704968a405e69d11ecf9",
  measurementId: "G-L1ZRDKGVHL",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const PORT = process.env.PORT || 6767;

// ── WebSocket Servers (noServer mode — share the HTTP server) ──
const wssEsp32Video = new WebSocketServer({ noServer: true });
const wssEsp32Audio = new WebSocketServer({ noServer: true });
const wssFrontendVideo = new WebSocketServer({ noServer: true });
const wssFrontendAudio = new WebSocketServer({ noServer: true });

// Helper: extract remote IP from a WebSocket upgrade request
function extractRemoteIp(ws, req) {
  if (!req) return;
  let rawIp = req.socket?.remoteAddress || "";
  if (rawIp.startsWith("::ffff:")) rawIp = rawIp.substring(7);
  if (rawIp && rawIp !== "127.0.0.1" && rawIp !== "::1") {
    lastEsp32Ip = rawIp;
    console.log(`[${new Date().toLocaleTimeString()}] Auto-discovered ESP32 IP from WebSocket: ${rawIp}`);
  }
}

// ESP32 video ingest → broadcast JPEG frames to all frontend video clients
wssEsp32Video.on("connection", (ws, req) => {
  console.log(`[${new Date().toLocaleTimeString()}] ESP32 video source connected`);
  extractRemoteIp(ws, req);
  ws.on("message", (data) => {
    wssFrontendVideo.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(data);
      }
    });
  });
  ws.on("close", () => {
    console.log(`[${new Date().toLocaleTimeString()}] ESP32 video source disconnected`);
  });
});

// ESP32 audio ingest → broadcast PCM chunks to all frontend audio clients
wssEsp32Audio.on("connection", (ws, req) => {
  console.log(`[${new Date().toLocaleTimeString()}] ESP32 audio source connected`);
  extractRemoteIp(ws, req);
  ws.on("message", (data) => {
    wssFrontendAudio.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(data);
      }
    });
  });
  ws.on("close", () => {
    console.log(`[${new Date().toLocaleTimeString()}] ESP32 audio source disconnected`);
  });
});

// Frontend relay connections — just log connect/disconnect
wssFrontendVideo.on("connection", (ws) => {
  console.log(`[${new Date().toLocaleTimeString()}] Frontend video client connected (total: ${wssFrontendVideo.clients.size})`);
  ws.on("close", () => {
    console.log(`[${new Date().toLocaleTimeString()}] Frontend video client disconnected (total: ${wssFrontendVideo.clients.size})`);
  });
});

wssFrontendAudio.on("connection", (ws) => {
  console.log(`[${new Date().toLocaleTimeString()}] Frontend audio client connected (total: ${wssFrontendAudio.clients.size})`);
  ws.on("close", () => {
    console.log(`[${new Date().toLocaleTimeString()}] Frontend audio client disconnected (total: ${wssFrontendAudio.clients.size})`);
  });
});

let currentAnnouncement = "";

onSnapshot(
  doc(db, "announcements", "current"),
  (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.active && data.text && typeof data.text === "string" && data.text.trim().length > 0) {
        currentAnnouncement = data.text.trim();
        console.log(`[${new Date().toLocaleTimeString()}] Live Announcement set: "${currentAnnouncement}"`);
      } else {
        currentAnnouncement = "";
        console.log(`[${new Date().toLocaleTimeString()}] Live Announcement cleared ("")`);
      }
    } else {
      currentAnnouncement = "";
    }
  },
  (err) => {
    console.error("Error watching announcements document:", err.message);
  }
);

let userCompanyMap = {};
let companyThresholds = {};

onSnapshot(
  collection(db, "users"),
  (snapshot) => {
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.id !== undefined && data.companyCode) {
        userCompanyMap[String(data.id)] = data.companyCode;
      }
    });
  },
  (err) => {
    console.error("Error watching users collection:", err.message);
  }
);

onSnapshot(
  collection(db, "companies"),
  (snapshot) => {
    snapshot.forEach((docSnap) => {
      if (docSnap.exists()) {
        const cData = docSnap.data();
        companyThresholds[docSnap.id] = {
          tempMax: cData.tempMax !== undefined ? Number(cData.tempMax) : 85,
          tempMin: cData.tempMin !== undefined ? Number(cData.tempMin) : 50,
          humidityMax: cData.humidityMax !== undefined ? Number(cData.humidityMax) : 80,
          checkInInterval: cData.checkInInterval !== undefined ? Number(cData.checkInInterval) : 15,
        };
      }
    });
  },
  (err) => {
    console.error("Error watching companies collection:", err.message);
  }
);

let lastEsp32Ip = null;

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toLocaleTimeString()}] HTTP ${req.method} ${req.url} from ${req.socket.remoteAddress}`);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/api/esp32-info")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ip: lastEsp32Ip,
        streamUrl: lastEsp32Ip ? `http://${lastEsp32Ip}/stream` : null,
      })
    );
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/api/video-proxy")) {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const espIp = parsedUrl.searchParams.get("ip") || lastEsp32Ip;
    if (!espIp) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "No ESP32 IP address available" }));
      return;
    }
    const targetUrl = `http://${espIp}/stream`;
    http
      .get(targetUrl, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      })
      .on("error", (err) => {
        console.error("Video proxy error:", err.message);
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Failed to connect to ESP32 stream", details: err.message }));
      });
    return;
  }

  if (req.url.startsWith("/api/announcement")) {
    if (req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ announcement: currentAnnouncement }));
      return;
    }

    if (req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk.toString()));
      req.on("end", async () => {
        try {
          const payload = JSON.parse(body);
          const newAnnouncement = payload.announcement ?? payload.text ?? 0;
          if (newAnnouncement && typeof newAnnouncement === "string" && newAnnouncement.trim().length > 0) {
            currentAnnouncement = newAnnouncement.trim();
            await setDoc(doc(db, "announcements", "current"), {
              text: currentAnnouncement,
              active: true,
              updatedAt: new Date().toISOString(),
            }, { merge: true });
          } else {
            currentAnnouncement = 0;
            await setDoc(doc(db, "announcements", "current"), {
              text: "",
              active: false,
              updatedAt: new Date().toISOString(),
            }, { merge: true });
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, announcement: currentAnnouncement }));
        } catch (err) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }
  }

  if (req.method === "POST" && req.url.startsWith("/api/data")) {
    // Record client IP address for ESP32 stream auto-discovery
    let rawIp = req.socket.remoteAddress || "";
    if (rawIp.startsWith("::ffff:")) {
      rawIp = rawIp.substring(7);
    }
    if (rawIp && rawIp !== "127.0.0.1" && rawIp !== "::1") {
      lastEsp32Ip = rawIp;
    }

    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const payload = JSON.parse(body);
        const deviceId = String(payload.id ?? "1");

        console.log(`[${new Date().toLocaleTimeString()}] Parsed Payload from Tag #${deviceId}:`, payload);

        const telemetryData = {
          id: payload.id ?? 1,
          status: payload.status || "active",
          checkingIn: Boolean(payload.checkingIn),
          timeSinceLastCheckIn: Number(payload.timeSinceLastCheckIn || 0),
          sensorData: {
            temperature: payload.sensorData?.temperature ?? null,
            humidity: payload.sensorData?.humidity ?? null,
          },
          gyroData: {
            x: payload.gyroData?.x ?? null,
            y: payload.gyroData?.y ?? null,
            z: payload.gyroData?.z ?? null,
          },
          accelData: {
            x: payload.accelData?.x ?? null,
            y: payload.accelData?.y ?? null,
            z: payload.accelData?.z ?? null,
          },
          updatedAt: new Date().toISOString(),
        };

        await setDoc(doc(db, "telemetry", deviceId), telemetryData, { merge: true });

        let tempMaxThreshold = 85;
        let tempMinThreshold = 50;
        let humidityThreshold = 80;
        let checkInInterval = 15;

        const targetCompanyCode = userCompanyMap[deviceId];
        let thresholds = null;

        if (targetCompanyCode && companyThresholds[targetCompanyCode]) {
          thresholds = companyThresholds[targetCompanyCode];
        } else if (companyThresholds["HIVEMIND"]) {
          thresholds = companyThresholds["HIVEMIND"];
        } else {
          const firstCode = Object.keys(companyThresholds)[0];
          if (firstCode) {
            thresholds = companyThresholds[firstCode];
          }
        }

        if (thresholds) {
          if (thresholds.tempMax !== undefined) tempMaxThreshold = thresholds.tempMax;
          if (thresholds.tempMin !== undefined) tempMinThreshold = thresholds.tempMin;
          if (thresholds.humidityMax !== undefined) humidityThreshold = thresholds.humidityMax;
          if (thresholds.checkInInterval !== undefined) checkInInterval = thresholds.checkInInterval;
        } else {
          try {
            const compSnap = await getDoc(doc(db, "companies", "HIVEMIND"));
            if (compSnap.exists()) {
              const cData = compSnap.data();
              if (cData.tempMax !== undefined) tempMaxThreshold = Number(cData.tempMax);
              if (cData.tempMin !== undefined) tempMinThreshold = Number(cData.tempMin);
              if (cData.humidityMax !== undefined) humidityThreshold = Number(cData.humidityMax);
              if (cData.checkInInterval !== undefined) checkInInterval = Number(cData.checkInInterval);
            }
          } catch (compErr) {}
        }

        const timeSinceLastCheckInSec = Number(payload.timeSinceLastCheckIn || 0);
        const checkInIntervalSec = checkInInterval * 60;

        let alertStatus = null;
        if (payload.status === "panic") {
          alertStatus = "panic";
        } else if (payload.status === "supervisor_call") {
          alertStatus = "supervisor_call";
        } else if (payload.status === "unresponsive") {
          alertStatus = "unresponsive";
        } else if (payload.status === "checkin" || payload.checkingIn || (checkInIntervalSec > 0 && timeSinceLastCheckInSec >= checkInIntervalSec)) {
          alertStatus = "checkin";
        }

        if (alertStatus) {
          await setDoc(doc(db, "alerts", deviceId), {
            deviceId: payload.id ?? 1,
            status: alertStatus,
            createdAt: new Date().toISOString(),
          });
        }

        const announcementToSend = (typeof currentAnnouncement === "string" && currentAnnouncement.trim().length > 0)
          ? currentAnnouncement.trim()
          : "";

        if (currentAnnouncement) {
          currentAnnouncement = "";
          setDoc(doc(db, "announcements", "current"), {
            text: "",
            active: false,
            updatedAt: new Date().toISOString(),
          }, { merge: true }).catch((err) => console.error("Error clearing DB announcement:", err.message));
        }

        const responseDoc = {
          tempMaxThreshold,
          tempMinThreshold,
          humidityThreshold,
          checkInInterval,
          announcement: announcementToSend,
        };

        const jsonString = JSON.stringify(responseDoc);
        const payloadBuffer = Buffer.from(jsonString, "utf-8");

        res.writeHead(200, {
          "Content-Type": "application/json",
          "Content-Length": payloadBuffer.length,
          "Connection": "close",
        });
        res.end(payloadBuffer);
        console.log(`[${new Date().toLocaleTimeString()}] Sent responseDoc to Tag #${deviceId}:`, responseDoc);
      } catch (err) {
        console.error("Failed to parse JSON packet:", err.message);
        const errObj = JSON.stringify({ success: false, error: err.message });
        res.writeHead(400, {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(errObj),
          "Connection": "close",
        });
        res.end(errObj);
      }
    });
    return;
  }

  if (req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "InductorStick Telemetry Server Active", port: PORT, currentAnnouncement, lastEsp32Ip }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Telemetry server listening on ALL interfaces (0.0.0.0:${PORT})`);
  console.log(`Arduino should POST to: http://192.168.1.176:${PORT}/api/data`);
  console.log(`WebSocket endpoints:`);
  console.log(`  ESP32 video ingest:   ws://0.0.0.0:${PORT}/api/video-stream`);
  console.log(`  ESP32 audio ingest:   ws://0.0.0.0:${PORT}/api/audio-stream (or /api/poopybutt-audio)`);
  console.log(`  Frontend video relay: ws://0.0.0.0:${PORT}/ws/live-video`);
  console.log(`  Frontend audio relay: ws://0.0.0.0:${PORT}/ws/live-audio`);
  console.log(`  ESP32 HTTP Video MJPEG Stream: http://<ESP32_IP>/stream or http://0.0.0.0:${PORT}/api/video-proxy`);
});

// ── Route WebSocket upgrade requests to the correct WSS instance ──
server.on("upgrade", (req, socket, head) => {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;

  if (pathname === "/api/video-stream") {
    wssEsp32Video.handleUpgrade(req, socket, head, (ws) => {
      wssEsp32Video.emit("connection", ws, req);
    });
  } else if (pathname === "/api/audio-stream" || pathname === "/api/poopybutt-audio") {
    wssEsp32Audio.handleUpgrade(req, socket, head, (ws) => {
      wssEsp32Audio.emit("connection", ws, req);
    });
  } else if (pathname === "/ws/live-video") {
    wssFrontendVideo.handleUpgrade(req, socket, head, (ws) => {
      wssFrontendVideo.emit("connection", ws, req);
    });
  } else if (pathname === "/ws/live-audio") {
    wssFrontendAudio.handleUpgrade(req, socket, head, (ws) => {
      wssFrontendAudio.emit("connection", ws, req);
    });
  } else {
    socket.destroy();
  }
});