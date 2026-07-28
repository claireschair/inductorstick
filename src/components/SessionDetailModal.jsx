import "../styles/EmployeeDetailModal.css";
import "../styles/SessionDetailModal.css";

function SessionDetailModal({ session, onClose }) {
  const { zone, date, checkIn, checkOut, duration, status, sensorSummary, minuteData, title } = session;
  const sessionTitle = title || (date ? `${date} Session` : zone || "Session");

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card session-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{sessionTitle}</h2>
            <span className={`status-badge status-${status}`}>{status}</span>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modal-section">
          <h3>Session Footage</h3>
          <div className="footage-placeholder">
            <p>Recorded footage will be replayable here once the ESP32 camera module is integrated.</p>
          </div>
        </div>

        <div className="modal-section">
          <h3>Session Details</h3>
          <p className="modal-detail-line">Date: {date}</p>
          <p className="modal-detail-line">Check-in: {checkIn || "Active"}</p>
          <p className="modal-detail-line">Check-out: {checkOut || "In Progress"}</p>
          <p className="modal-detail-line">Duration: {duration || "Active"}</p>
        </div>

        <div className="modal-section">
          <h3>Overall Sensor Summary</h3>
          <div className="modal-sensor-grid">
            <div className="sensor-stat">
              <span className="sensor-label">Avg Temp</span>
              <span className="sensor-value">{sensorSummary?.avgTemp ?? "--"}°F</span>
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
        </div>

        {minuteData && minuteData.length > 0 && (
          <div className="modal-section">
            <h3>Minute-by-Minute Averages</h3>
            <div style={{ maxHeight: "160px", overflowY: "auto", border: "1px solid var(--color-secondary)", borderRadius: "4px", padding: "8px" }}>
              <table style={{ width: "100%", textAlign: "left", fontSize: "0.85rem", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--color-secondary)" }}>
                    <th style={{ padding: "4px" }}>Time</th>
                    <th style={{ padding: "4px" }}>Avg Temp</th>
                    <th style={{ padding: "4px" }}>Avg Humidity</th>
                    <th style={{ padding: "4px" }}>Max Sound</th>
                  </tr>
                </thead>
                <tbody>
                  {minuteData.map((m, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: "4px" }}>{m.timeDisplay || `Min ${idx + 1}`}</td>
                      <td style={{ padding: "4px" }}>{m.avgTemp}°F</td>
                      <td style={{ padding: "4px" }}>{m.avgHumidity}%</td>
                      <td style={{ padding: "4px" }}>{m.maxSound} dB</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SessionDetailModal;