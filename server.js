import http from "http";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

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

const PORT = process.env.PORT || 8080;

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

  if (req.method === "POST" && req.url.startsWith("/api/data")) {
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
          zone: payload.zone || "Zone A",
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
          position: {
            x: payload.position?.x ?? null,
            y: payload.position?.y ?? null,
          },
          updatedAt: new Date().toISOString(),
        };

        await setDoc(doc(db, "telemetry", deviceId), telemetryData, { merge: true });

        if (payload.status === "panic" || payload.status === "supervisor_call") {
          await setDoc(doc(db, "alerts", deviceId), {
            deviceId: payload.id ?? 1,
            status: payload.status,
            createdAt: new Date().toISOString(),
          });
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, id: deviceId }));
      } catch (err) {
        console.error("Failed to parse JSON packet:", err.message);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "InductorStick Telemetry Server Active", port: PORT, ip: "192.168.1.176" }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Telemetry server listening on ALL interfaces (0.0.0.0:${PORT})`);
  console.log(`Arduino should POST to: http://192.168.1.176:${PORT}/api/data`);
});