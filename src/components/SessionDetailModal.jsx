import { X, Play } from "lucide-react";
import "../styles/EmployeeDetailModal.css";
import "../styles/SessionDetailModal.css";

function SessionDetailModal({ session, onClose }) {
  const { zone, date, checkIn, checkOut, duration, status, sensorSummary } = session;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{zone}</h2>
            <span className={`status-badge status-${status}`}>{status}</span>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-section">
          <h3>Session Footage</h3>
          <div className="footage-placeholder">
            <Play size={28} />
            <p>Recorded footage will be replayable here once the ESP32 camera module is integrated.</p>
          </div>
        </div>

        <div className="modal-section">
          <h3>Session Details</h3>
          <p className="modal-detail-line">Date: {date}</p>
          <p className="modal-detail-line">Check-in: {checkIn}</p>
          <p className="modal-detail-line">Check-out: {checkOut}</p>
          <p className="modal-detail-line">Duration: {duration}</p>
        </div>

        <div className="modal-section">
          <h3>Sensor Summary</h3>
          <div className="modal-sensor-grid">
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
        </div>
      </div>
    </div>
  );
}

export default SessionDetailModal;