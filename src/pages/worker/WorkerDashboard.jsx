import ActivityHistoryItem from "../../components/ActivityHistoryItem";
import mockActivityHistory from "../../data/mockActivityHistory";
import "../../styles/WorkerDashboard.css";

function WorkerDashboard() {
  return (
    <div className="page">
      <h1>My Activity</h1>

      <div className="camera-placeholder">
        <p>Live camera footage will appear here once the ESP32 camera module is connected.</p>
      </div>

      <h2 className="section-heading">Recent Sessions</h2>
      <div className="activity-list">
        {mockActivityHistory.map((session) => (
          <ActivityHistoryItem key={session.id} session={session} />
        ))}
      </div>
    </div>
  );
}

export default WorkerDashboard;