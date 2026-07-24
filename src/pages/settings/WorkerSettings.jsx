import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { ShieldCheck } from "lucide-react";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import "../../styles/Settings.css";

function WorkerSettings() {
  const { userProfile } = useAuth();
  const [thresholds, setThresholds] = useState({
    tempMax: 85,
    tempMin: 50,
    soundMax: 90,
    humidityMax: 80,
    checkInInterval: 15,
  });

  const companyCode = userProfile?.companyCode || "N/A";
  const companyName = userProfile?.companyName || "Your Company";

  useEffect(() => {
    async function loadCompanyThresholds() {
      if (!userProfile?.companyCode) return;
      try {
        const compSnap = await getDoc(doc(db, "companies", userProfile.companyCode));
        if (compSnap.exists()) {
          const data = compSnap.data();
          setThresholds({
            tempMax: data.tempMax ?? 85,
            tempMin: data.tempMin ?? 50,
            soundMax: data.soundMax ?? 90,
            humidityMax: data.humidityMax ?? 80,
            checkInInterval: data.checkInInterval ?? 15,
          });
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadCompanyThresholds();
  }, [userProfile?.companyCode]);

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Employee Settings</h1>
      </div>

      <div className="settings-card">
        <h2>Company Affiliation</h2>
        <p className="modal-detail-line">
          <strong>Company Name:</strong> {companyName}
        </p>
        <p className="modal-detail-line">
          <strong>Company Join Code:</strong> <span className="company-code-value">{companyCode}</span>
        </p>
      </div>

      <div className="settings-card">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <h2>Supervisor Safety Rules</h2>
          <ShieldCheck size={20} color="var(--color-primary)" />
        </div>

        <div className="threshold-readonly-grid">
          <div className="threshold-stat-box">
            <span className="stat-box-label">Max Temperature</span>
            <span className="stat-box-value">{thresholds.tempMax}°F</span>
          </div>
          <div className="threshold-stat-box">
            <span className="stat-box-label">Min Temperature</span>
            <span className="stat-box-value">{thresholds.tempMin}°F</span>
          </div>
          <div className="threshold-stat-box">
            <span className="stat-box-label">Sound Limit</span>
            <span className="stat-box-value">{thresholds.soundMax} dB</span>
          </div>
          <div className="threshold-stat-box">
            <span className="stat-box-label">Humidity Limit</span>
            <span className="stat-box-value">{thresholds.humidityMax}%</span>
          </div>
          <div className="threshold-stat-box">
            <span className="stat-box-label">Check-In Timer</span>
            <span className="stat-box-value">{thresholds.checkInInterval} mins</span>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <h2>My Account</h2>
        <p className="modal-detail-line">
          <strong>Name:</strong> {userProfile?.firstName} {userProfile?.lastName}
        </p>
        <p className="modal-detail-line">
          <strong>Email:</strong> {userProfile?.email}
        </p>
        <p className="modal-detail-line">
          <strong>Role:</strong> Employee
        </p>
      </div>
    </div>
  );
}

export default WorkerSettings;
