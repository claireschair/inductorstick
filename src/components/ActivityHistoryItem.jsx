import "../styles/ActivityHistoryItem.css";

function ActivityHistoryItem({ session, onClick }) {
  const { date, checkIn, checkOut, duration, status, sensorSummary, title } = session;
  const sessionTitle = title || (date ? `${date} Session` : "Session");

  return (
    <button className="activity-item activity-item-clickable" onClick={onClick}>
      <div className="activity-item-header">
        <div>
          <h3>{sessionTitle}</h3>
        </div>
        {status && status !== "completed" && (
          <span className={`status-badge status-${status}`}>{status}</span>
        )}
      </div>

      <div className="activity-times">
        <span>Check-in: {checkIn || "N/A"}</span>
        <span>Check-out: {checkOut || "N/A"}</span>
        <span>Duration: {duration || "N/A"}</span>
      </div>

      <div className="sensor-readings">
        <div className="sensor-stat">
          <span className="sensor-label">Avg Temp</span>
          <span className="sensor-value">{sensorSummary?.avgTemp ?? "--"}°C</span>
        </div>
        <div className="sensor-stat">
          <span className="sensor-label">Avg Humidity</span>
          <span className="sensor-value">{sensorSummary?.avgHumidity ?? "--"}%</span>
        </div>
        <div className="sensor-stat">
          <span className="sensor-label">Max Sound</span>
          <span className="sensor-value">{sensorSummary?.maxSound ?? "--"} dB</span>
        </div>
      </div>
    </button>
  );
}

export default ActivityHistoryItem;