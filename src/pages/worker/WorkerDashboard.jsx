import { useState } from "react";
import ActivityHistoryItem from "../../components/ActivityHistoryItem";
import SessionDetailModal from "../../components/SessionDetailModal";
import mockActivityHistory from "../../data/mockActivityHistory";
import "../../styles/WorkerDashboard.css";

function WorkerDashboard() {
  const [selectedSession, setSelectedSession] = useState(null);

  return (
    <div className="worker-page">
      <h1>My Activity</h1>

      <h2 className="section-heading">Recent Sessions</h2>
      <div className="activity-list">
        {mockActivityHistory.map((session) => (
          <ActivityHistoryItem
            key={session.id}
            session={session}
            onClick={() => setSelectedSession(session)}
          />
        ))}
      </div>

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