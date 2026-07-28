import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import ActivityHistoryItem from "../../components/ActivityHistoryItem";
import SessionDetailModal from "../../components/SessionDetailModal";
import "../../styles/WorkerDashboard.css";

function WorkerDashboard() {
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currentUser, userProfile } = useAuth();

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const sessionsRef = collection(db, "sessions");
    const unsubscribe = onSnapshot(
      sessionsRef,
      (snapshot) => {
        const list = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const matchesUid = data.userUid === currentUser.uid;
          const matchesId = userProfile?.id && Number(data.userId) === Number(userProfile.id);
          if (matchesUid || matchesId) {
            list.push({
              id: docSnap.id,
              ...data,
            });
          }
        });
        list.sort((a, b) => new Date(b.createdAt || b.checkInTime) - new Date(a.createdAt || a.checkInTime));
        setSessions(list);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser, userProfile]);

  return (
    <div className="worker-page">
      <h1>Recent Sessions</h1>

      {loading ? (
        <p>Loading activity sessions...</p>
      ) : sessions.length === 0 ? (
        <div className="empty-state" style={{ padding: "20px", background: "#ffffff", borderRadius: "0px", border: "1px solid var(--color-secondary)" }}>
          <p style={{ margin: 0, color: "var(--color-secondary)" }}>
            No activity sessions recorded yet. Enter your Worker ID #{userProfile?.id || ""} on the Terminal page to check in.
          </p>
        </div>
      ) : (
        <div className="activity-list">
          {sessions.map((session) => (
            <ActivityHistoryItem
              key={session.id}
              session={session}
              onClick={() => setSelectedSession(session)}
            />
          ))}
        </div>
      )}

      {selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
        />
      )}
    </div>
  );
}

export default WorkerDashboard;