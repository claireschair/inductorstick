import http from "http";
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

const PORT = process.env.PORT || 8080;

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
    res.end(JSON.stringify({ status: "InductorStick Telemetry Server Active", port: PORT, currentAnnouncement }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Telemetry server listening on ALL interfaces (0.0.0.0:${PORT})`);
  console.log(`Arduino should POST to: http://192.168.1.176:${PORT}/api/data`);
});