import { useState, useEffect, useCallback } from "react";
import { collection, query, where, getDocs, addDoc, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import "../styles/Larp.css";

function Larp() {
  const [workerId, setWorkerId] = useState("");
  const [status, setStatus] = useState("idle");
  const [activeId, setActiveId] = useState("");
  const [message, setMessage] = useState("");
  const [msgType, setMsgType] = useState("success");

  const handleKeyPress = useCallback((num) => {
    if (status === "success" || status === "error") {
      setStatus("idle");
      setMessage("");
      setWorkerId(num.toString());
      return;
    }
    setWorkerId((prev) => (prev.length < 8 ? prev + num : prev));
  }, [status]);

  const handleDelete = useCallback(() => {
    if (status === "success" || status === "error") {
      setStatus("idle");
      setMessage("");
      setWorkerId("");
      return;
    }
    setWorkerId((prev) => prev.slice(0, -1));
  }, [status]);

  const handleClear = useCallback(() => {
    setWorkerId("");
    setStatus("idle");
    setMessage("");
  }, []);

  const handleCheckIn = useCallback(async () => {
    if (!workerId) return;
    const targetId = Number(workerId);
    setActiveId(workerId);
    setStatus("verifying");
    setMessage("");

    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("id", "==", targetId));
      const querySnap = await getDocs(q);

      if (querySnap.empty) {
        setStatus("error");
        setMsgType("error");
        setMessage(`Worker #${targetId} not found.`);
        return;
      }

      const userDoc = querySnap.docs[0];
      const userData = userDoc.data();
      const userUid = userDoc.id;

      if (userData.checkedIn && userData.activeSessionId) {
        setStatus("error");
        setMsgType("error");
        setMessage(`Worker #${targetId} (${userData.firstName} ${userData.lastName}) is already checked in.`);
        return;
      }

      const now = new Date();
      const sessionRef = await addDoc(collection(db, "sessions"), {
        userId: targetId,
        userUid: userUid,
        workerName: `${userData.firstName} ${userData.lastName}`,
        companyCode: userData.companyCode || "",
        checkInTime: now.toISOString(),
        checkOutTime: null,
        status: "active",
        date: now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
        checkIn: now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        checkOut: null,
        duration: null,
        minuteData: [],
        sensorSummary: {
          avgTemp: 0,
          avgHumidity: 0,
          maxSound: 0,
        },
        createdAt: now.toISOString(),
      });

      await updateDoc(doc(db, "users", userUid), {
        checkedIn: true,
        activeSessionId: sessionRef.id,
        lastCheckIn: now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        lastCheckInTime: now.toISOString(),
      });

      setStatus("success");
      setMsgType("success");
      setMessage(`Worker #${targetId} (${userData.firstName} ${userData.lastName}) checked in successfully at ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`);
    } catch (err) {
      console.error(err);
      setStatus("error");
      setMsgType("error");
      setMessage("Failed to check in worker. Please try again.");
    }
  }, [workerId]);

  const handleCheckOut = useCallback(async () => {
    if (!workerId) return;
    const targetId = Number(workerId);
    setActiveId(workerId);
    setStatus("verifying");
    setMessage("");

    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("id", "==", targetId));
      const querySnap = await getDocs(q);

      if (querySnap.empty) {
        setStatus("error");
        setMsgType("error");
        setMessage(`Worker #${targetId} not found.`);
        return;
      }

      const userDoc = querySnap.docs[0];
      const userData = userDoc.data();
      const userUid = userDoc.id;

      let sessionId = userData.activeSessionId;
      let sessionSnap = null;

      if (sessionId) {
        const sDoc = await getDoc(doc(db, "sessions", sessionId));
        if (sDoc.exists() && sDoc.data().status === "active") {
          sessionSnap = sDoc;
        }
      }

      if (!sessionSnap) {
        const sessionsRef = collection(db, "sessions");
        const sq = query(sessionsRef, where("userId", "==", targetId), where("status", "==", "active"));
        const sqSnap = await getDocs(sq);
        if (!sqSnap.empty) {
          sessionSnap = sqSnap.docs[0];
          sessionId = sessionSnap.id;
        }
      }

      if (!sessionSnap) {
        setStatus("error");
        setMsgType("error");
        setMessage(`Worker #${targetId} (${userData.firstName} ${userData.lastName}) is not currently checked in.`);
        return;
      }

      const sessionData = sessionSnap.data();
      const now = new Date();
      const checkInDate = new Date(sessionData.checkInTime);
      const diffMs = now - checkInDate;
      const diffMins = Math.max(1, Math.round(diffMs / 60000));
      let durationStr = `${diffMins}m`;
      if (diffMins >= 60) {
        const hrs = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        durationStr = `${hrs}h ${mins}m`;
      }

      let minuteData = sessionData.minuteData || [];

      if (minuteData.length === 0) {
        const telemSnap = await getDoc(doc(db, "telemetry", String(targetId)));
        if (telemSnap.exists()) {
          const tData = telemSnap.data();
          const liveTemp = tData?.sensorData?.temperature ?? tData?.temperature ?? tData?.temp ?? 75;
          const liveHum = tData?.sensorData?.humidity ?? tData?.humidity ?? 50;
          const liveSound = tData?.sensorData?.sound ?? tData?.sound ?? 65;

          const snapshotEntry = {
            timestamp: now.toISOString(),
            timeDisplay: now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
            avgTemp: Math.round(liveTemp),
            avgHumidity: Math.round(liveHum),
            maxSound: Math.round(liveSound),
          };
          minuteData = [snapshotEntry];
        }
      }

      let finalAvgTemp = 75;
      let finalAvgHumidity = 50;
      let finalMaxSound = 65;

      if (minuteData.length > 0) {
        const tSum = minuteData.reduce((acc, m) => acc + (m.avgTemp || 0), 0);
        const hSum = minuteData.reduce((acc, m) => acc + (m.avgHumidity || 0), 0);
        finalAvgTemp = Math.round(tSum / minuteData.length);
        finalAvgHumidity = Math.round(hSum / minuteData.length);
        finalMaxSound = Math.max(...minuteData.map((m) => m.maxSound || 0));
      }

      await updateDoc(doc(db, "sessions", sessionId), {
        status: "completed",
        checkOutTime: now.toISOString(),
        checkOut: now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        duration: durationStr,
        minuteData: minuteData,
        sensorSummary: {
          avgTemp: finalAvgTemp,
          avgHumidity: finalAvgHumidity,
          maxSound: finalMaxSound,
        },
      });

      await updateDoc(doc(db, "users", userUid), {
        checkedIn: false,
        activeSessionId: null,
        lastCheckOut: now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        lastCheckOutTime: now.toISOString(),
      });

      setStatus("success");
      setMsgType("success");
      setMessage(`Worker #${targetId} (${userData.firstName} ${userData.lastName}) checked out successfully. Session completed (${durationStr}).`);
    } catch (err) {
      console.error(err);
      setStatus("error");
      setMsgType("error");
      setMessage("Failed to check out worker. Please try again.");
    }
  }, [workerId]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key >= "0" && e.key <= "9") {
        handleKeyPress(e.key);
      } else if (e.key === "Backspace") {
        handleDelete();
      } else if (e.key === "Escape") {
        handleClear();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [workerId, status, handleKeyPress, handleDelete, handleClear]);

  return (
    <div className="larp-simple-container">
      <div className="larp-top-row">
        <span className="larp-title">Worker Tag Terminal</span>
      </div>

      <div className="larp-main-layout">
        <div className="larp-screen">
          {status === "idle" && (
            <div>
              <div className="larp-label">Worker ID:</div>
              <div className="larp-id-display">
                {workerId || "Enter ID..."}
              </div>
            </div>
          )}

          {status === "verifying" && (
            <div className="larp-status-msg">
              Processing worker #{activeId}...
            </div>
          )}

          {(status === "success" || status === "error") && (
            <div>
              <div className={msgType === "success" ? "larp-success-msg" : "larp-error-msg"}>
                {message}
              </div>
              <button className="larp-reset-btn" onClick={handleClear}>
                Reset Terminal
              </button>
            </div>
          )}
        </div>

        <div className="larp-pad">
          <div className="larp-grid">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                className="larp-btn"
                onClick={() => handleKeyPress(num)}
                disabled={status === "verifying"}
              >
                {num}
              </button>
            ))}
            <button
              className="larp-btn larp-btn-clr"
              onClick={handleClear}
              disabled={status === "verifying"}
            >
              Clear
            </button>
            <button
              className="larp-btn"
              onClick={() => handleKeyPress(0)}
              disabled={status === "verifying"}
            >
              0
            </button>
            <button
              className="larp-btn larp-btn-del"
              onClick={handleDelete}
              disabled={status === "verifying"}
            >
              Del
            </button>
          </div>
          <div className="larp-action-row">
            <button
              className="larp-checkin-btn"
              onClick={handleCheckIn}
              disabled={!workerId || status === "verifying"}
            >
              Check In
            </button>
            <button
              className="larp-checkout-btn"
              onClick={handleCheckOut}
              disabled={!workerId || status === "verifying"}
            >
              Check Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Larp;
