import { X } from "lucide-react";
import "../styles/EmployeeDetailModal.css";

function EmployeeDetailModal({ employee, onClose }) {
  const { firstName, lastName, zone, status, lastCheckIn, position, sensorData } = employee;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>
              {firstName} {lastName}
            </h2>
            <span className={`status-badge status-${status}`}>{status}</span>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-section">
          <h3>Location</h3>
          <div className="facility-map">
            <div
              className="facility-marker"
              style={{ left: `${position.x}%`, top: `${position.y}%` }}
            />
          </div>
          <p className="modal-zone">{zone}</p>
        </div>

        <div className="modal-section">
          <h3>Check-In Status</h3>
          <p className="modal-detail-line">Last check-in: {lastCheckIn}</p>
        </div>

        <div className="modal-section">
          <h3>Sensor Readings</h3>
          <div className="modal-sensor-grid">
            <div className="sensor-stat">
              <span className="sensor-label">Temp</span>
              <span className="sensor-value">{sensorData.temperature}°F</span>
            </div>
            <div className="sensor-stat">
              <span className="sensor-label">Humidity</span>
              <span className="sensor-value">{sensorData.humidity}%</span>
            </div>
            <div className="sensor-stat">
              <span className="sensor-label">Sound</span>
              <span className="sensor-value">{sensorData.sound} dB</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmployeeDetailModal;