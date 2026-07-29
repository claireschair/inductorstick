import { useEffect, useState, useRef } from "react";
import { collection, onSnapshot, query, where, getDocs, doc, updateDoc, arrayUnion, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { TelemetryContext } from "./TelemetryContext";

export function TelemetryProvider({ children }) {
  const [telemetryMap, setTelemetryMap] = useState({});
  const [loadingTelemetry, setLoadingTelemetry] = useState(true);
  const [activeSessionsByUserId, setActiveSessionsByUserId] = useState({});
  const [alerts, setAlerts] = useState([]);
  const bufferRef = useRef({});
  const telemetryMapRef = useRef({});
  const activeSessionsRef = useRef({});

  useEffect(() => {
    telemetryMapRef.current = telemetryMap;
  }, [telemetryMap]);

  useEffect(() => {
    activeSessionsRef.current = activeSessionsByUserId;
  }, [activeSessionsByUserId]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "telemetry"),
      (snapshot) => {
        const dataMap = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const devId = String(docSnap.id);
          dataMap[devId] = data;

          if (!bufferRef.current[devId]) {
            bufferRef.current[devId] = [];
          }
          bufferRef.current[devId].push(data);
        });
        setTelemetryMap(dataMap);
        setLoadingTelemetry(false);
      },
      (err) => {
        console.error(err);
        setLoadingTelemetry(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const sessionsRef = collection(db, "sessions");
    const q = query(sessionsRef, where("status", "==", "active"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const sessionMap = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          sessionMap[String(data.userId)] = {
            sessionId: docSnap.id,
            workerName: data.workerName,
            zone: data.zone,
          };
        });
        setActiveSessionsByUserId(sessionMap);
      },
      (err) => {
        console.error(err);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const sessionsRef = collection(db, "sessions");
        const q = query(sessionsRef, where("status", "==", "active"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return;

        snapshot.forEach(async (sessionDoc) => {
          const sessionData = sessionDoc.data();
          const devId = String(sessionData.userId);
          const bufferedReadings = bufferRef.current[devId] || [];
          const currentReading = telemetryMapRef.current[devId];

          let temps = [];
          let hums = [];
          let sounds = [];

          bufferedReadings.forEach((r) => {
            const t = r?.sensorData?.temperature ?? r?.temperature ?? r?.temp;
            const h = r?.sensorData?.humidity ?? r?.humidity;
            const s = r?.sensorData?.sound ?? r?.sound;
            if (typeof t === "number") temps.push(t);
            if (typeof h === "number") hums.push(h);
            if (typeof s === "number") sounds.push(s);
          });

          if (temps.length === 0 && currentReading) {
            const t = currentReading?.sensorData?.temperature ?? currentReading?.temperature ?? currentReading?.temp;
            const h = currentReading?.sensorData?.humidity ?? currentReading?.humidity;
            const s = currentReading?.sensorData?.sound ?? currentReading?.sound;
            if (typeof t === "number") temps.push(t);
            if (typeof h === "number") hums.push(h);
            if (typeof s === "number") sounds.push(s);
          }

          const avgTemp = temps.length > 0 ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length) : 75;
          const avgHumidity = hums.length > 0 ? Math.round(hums.reduce((a, b) => a + b, 0) / hums.length) : 50;
          const maxSound = sounds.length > 0 ? Math.max(...sounds) : 65;

          const now = new Date();
          const minuteEntry = {
            timestamp: now.toISOString(),
            timeDisplay: now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
            avgTemp,
            avgHumidity,
            maxSound,
          };

          const existingMinuteData = sessionData.minuteData || [];
          const updatedMinuteData = [...existingMinuteData, minuteEntry];

          const totalTemps = updatedMinuteData.reduce((acc, m) => acc + (m.avgTemp || 0), 0);
          const totalHums = updatedMinuteData.reduce((acc, m) => acc + (m.avgHumidity || 0), 0);
          const overallAvgTemp = Math.round(totalTemps / updatedMinuteData.length);
          const overallAvgHumidity = Math.round(totalHums / updatedMinuteData.length);
          const overallMaxSound = Math.max(...updatedMinuteData.map((m) => m.maxSound || 0));

          await updateDoc(doc(db, "sessions", sessionDoc.id), {
            minuteData: arrayUnion(minuteEntry),
            sensorSummary: {
              avgTemp: overallAvgTemp,
              avgHumidity: overallAvgHumidity,
              maxSound: overallMaxSound,
            },
          });

          bufferRef.current[devId] = [];
        });
      } catch (err) {
        console.error("Error logging telemetry averages:", err);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "alerts"),
      (snapshot) => {
        const alertList = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const deviceId = String(docSnap.id);
          const session = activeSessionsRef.current[deviceId];
          return {
            deviceId,
            status: data.status,
            createdAt: data.createdAt,
            workerName: session?.workerName || `Worker #${deviceId}`,
            zone: session?.zone || "Unknown Zone",
          };
        });
        setAlerts(alertList);
      },
      (err) => {
        console.error(err);
      }
    );

    return () => unsubscribe();
  }, []);

  async function dismissAlert(deviceId) {
    try {
      await deleteDoc(doc(db, "alerts", deviceId));
    } catch (err) {
      console.error(err);
    }
  }

  const getDeviceTelemetry = (id) => {
    return telemetryMap[String(id)] || null;
  };

  const value = {
    telemetryMap,
    loadingTelemetry,
    getDeviceTelemetry,
    activeSessionsByUserId,
    alerts,
    dismissAlert,
  };

  return (
    <TelemetryContext.Provider value={value}>
      {children}
    </TelemetryContext.Provider>
  );
}