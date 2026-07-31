import { useEffect, useState } from "react";
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import "../../styles/Settings.css";

function SupervisorSettings() {
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const [teamMembers, setTeamMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [promotingId, setPromotingId] = useState(null);
  const [creatorId, setCreatorId] = useState(null);

  const [tempMax, setTempMax] = useState(85);
  const [tempMin, setTempMin] = useState(50);
  const [soundMax, setSoundMax] = useState(90);
  const [humidityMax, setHumidityMax] = useState(80);
  const [checkInInterval, setCheckInInterval] = useState(15);
  const [savingThresholds, setSavingThresholds] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const companyCode = userProfile?.companyCode || "N/A";
  const companyName = userProfile?.companyName || "Your Company";

  useEffect(() => {
    async function loadCompanyData() {
      if (!userProfile?.companyCode) return;

      try {
        const compSnap = await getDoc(doc(db, "companies", userProfile.companyCode));
        if (compSnap.exists()) {
          const data = compSnap.data();
          if (data.createdBy) setCreatorId(data.createdBy);
          if (data.tempMax !== undefined) setTempMax(data.tempMax);
          if (data.tempMin !== undefined) setTempMin(data.tempMin);
          if (data.soundMax !== undefined) setSoundMax(data.soundMax);
          if (data.humidityMax !== undefined) setHumidityMax(data.humidityMax);
          if (data.checkInInterval !== undefined) setCheckInInterval(data.checkInInterval);
        }
      } catch (err) {
        console.error(err);
      }
    }

    async function loadTeamMembers() {
      if (!userProfile?.companyCode) {
        setLoadingMembers(false);
        return;
      }

      try {
        const q = query(
          collection(db, "users"),
          where("companyCode", "==", userProfile.companyCode)
        );
        const querySnapshot = await getDocs(q);
        const members = [];
        querySnapshot.forEach((docSnap) => {
          members.push({ docId: docSnap.id, ...docSnap.data() });
        });
        setTeamMembers(members);
      } catch (err) {
        console.error(err);
      }
      setLoadingMembers(false);
    }

    loadCompanyData();
    loadTeamMembers();
  }, [userProfile?.companyCode]);

  async function handleRoleChange(targetDocId, newRole) {
    if (targetDocId === creatorId || targetDocId === currentUser?.uid) return;

    setPromotingId(targetDocId);
    try {
      await updateDoc(doc(db, "users", targetDocId), {
        role: newRole,
      });

      setTeamMembers((prev) =>
        prev.map((member) =>
          member.docId === targetDocId ? { ...member, role: newRole } : member
        )
      );

      if (targetDocId === currentUser?.uid) {
        await refreshProfile();
      }
    } catch (err) {
      console.error(err);
    }
    setPromotingId(null);
  }

  async function handleSaveThresholds(e) {
    e.preventDefault();
    if (!userProfile?.companyCode) return;

    setSavingThresholds(true);
    setSaveMessage("");

    try {
      await updateDoc(doc(db, "companies", userProfile.companyCode), {
        tempMax: Number(tempMax),
        tempMin: Number(tempMin),
        soundMax: Number(soundMax),
        humidityMax: Number(humidityMax),
        checkInInterval: Number(checkInInterval),
      });
      setSaveMessage("Thresholds saved successfully.");
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (err) {
      console.error(err);
      setSaveMessage("Failed to save thresholds.");
    }
    setSavingThresholds(false);
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Settings</h1>
      </div>

      <div className="settings-card">
        <h2>Company Info</h2>
        <p className="modal-detail-line">
          <strong>Company Name:</strong> {companyName}
        </p>
        <div>
          <p className="modal-detail-line"><strong>Company Join Code:</strong> <span className="company-code-value">{companyCode}</span></p>
        </div>
      </div>

      <div className="settings-card">
        <h2>Sensor Thresholds</h2>
        <form onSubmit={handleSaveThresholds} className="threshold-grid">
          <div className="threshold-field">
            <label htmlFor="temp-max">Max Safe Temp (°C)</label>
            <input
              id="temp-max"
              type="number"
              value={tempMax}
              onChange={(e) => setTempMax(e.target.value)}
              required
            />
          </div>
          <div className="threshold-field">
            <label htmlFor="temp-min">Min Safe Temp (°C)</label>
            <input
              id="temp-min"
              type="number"
              value={tempMin}
              onChange={(e) => setTempMin(e.target.value)}
              required
            />
          </div>
          <div className="threshold-field">
            <label htmlFor="sound-max">Sound Warning Limit (dB)</label>
            <input
              id="sound-max"
              type="number"
              value={soundMax}
              onChange={(e) => setSoundMax(e.target.value)}
              required
            />
          </div>
          <div className="threshold-field">
            <label htmlFor="humidity-max">Max Humidity (%)</label>
            <input
              id="humidity-max"
              type="number"
              value={humidityMax}
              onChange={(e) => setHumidityMax(e.target.value)}
              required
            />
          </div>
          <div className="threshold-field">
            <label htmlFor="checkin-time">Check-In Interval (Minutes)</label>
            <input
              id="checkin-time"
              type="number"
              value={checkInInterval}
              onChange={(e) => setCheckInInterval(e.target.value)}
              required
            />
          </div>

          <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.5rem" }}>
            <button type="submit" className="btn-primary" disabled={savingThresholds}>
              {savingThresholds ? "Saving..." : "Save Safety Rules"}
            </button>
            {saveMessage && <span className="save-status">{saveMessage}</span>}
          </div>
        </form>
      </div>

      <div className="settings-card">
        <h2>Team Management</h2>
        {loadingMembers ? (
          <p className="settings-subtitle">Loading team members...</p>
        ) : teamMembers.length === 0 ? (
          <p className="settings-subtitle">No team members registered under code {companyCode} yet.</p>
        ) : (
          <div className="team-list">
            {teamMembers.map((member) => {
              const isCreator = member.docId === creatorId || member.isCreator || member.isOwner || member.role === "owner";
              const isSelf = member.docId === currentUser?.uid;
              return (
                <div key={member.docId} className="team-member-item">
                  <div className="team-member-info">
                    <div className="team-member-name">
                      {member.firstName} {member.lastName}
                      <span style={{ fontSize: "0.85rem", color: "var(--color-primary)", fontWeight: "bold", marginLeft: "0.4rem" }}>
                        (ID #{member.id ?? "N/A"})
                      </span>
                      <span className="role-tag-dash">
                        — {isCreator ? "Head Supervisor" : member.role === "supervisor" ? "Supervisor" : "Employee"}
                      </span>
                    </div>
                    <span className="team-member-email">{member.email}</span>
                  </div>

                  <div>
                    {isCreator ? (
                      <span className="settings-subtitle" style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        (Locked)
                      </span>
                    ) : isSelf ? (
                      <span className="settings-subtitle" style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        You (Supervisor)
                      </span>
                    ) : member.role === "supervisor" ? (
                      <button
                        className="btn-demote"
                        onClick={() => handleRoleChange(member.docId, "worker")}
                        disabled={promotingId === member.docId}
                      >
                        {promotingId === member.docId ? "Demoting..." : "Demote"}
                      </button>
                    ) : (
                      <button
                        className="btn-promote"
                        onClick={() => handleRoleChange(member.docId, "supervisor")}
                        disabled={promotingId === member.docId}
                      >
                        {promotingId === member.docId ? "Promoting..." : "Promote"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default SupervisorSettings;
