import "../styles/ActivityHistoryItem.css";

function ActivityHistoryItem({ session, onClick }) {
  const { zone, date, checkIn, checkOut, duration, status, sensorSummary } = session;

  return (
    <button className="activity-item activity-item-clickable" onClick={onClick}>
      <div className="activity-item-header">
        <div>
          <h3>{zone}</h3>
          <p className="activity-date">{date}</p>
        </div>
        <span className={`status-badge status-${status}`}>{status}</span>
      </div>

      <div className="activity-times">
        <span>Check-in: {checkIn}</span>
        <span>Check-out: {checkOut}</span>
        <span>Duration: {duration}</span>
      </div>

      <div className="sensor-readings">
        <div className="sensor-stat">
          <span className="sensor-label">Avg Temp</span>
          <span className="sensor-value">{sensorSummary.avgTemp}°F</span>
        </div>
        <div className="sensor-stat">
          <span className="sensor-label">Avg Humidity</span>
          <span className="sensor-value">{sensorSummary.avgHumidity}%</span>
        </div>
        <div className="sensor-stat">
          <span className="sensor-label">Max Sound</span>
          <span className="sensor-value">{sensorSummary.maxSound} dB</span>
        </div>
      </div>
    </button>
  );
}

export default ActivityHistoryItem;