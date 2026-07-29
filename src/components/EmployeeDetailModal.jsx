import { useTelemetry } from "../context/TelemetryContext";
import "../styles/EmployeeDetailModal.css";

function EmployeeDetailModal({ employee, onClose }) {
  const { getDeviceTelemetry } = useTelemetry();
  const liveTelemetry = getDeviceTelemetry(employee.id);

  const { firstName, lastName } = employee;

  const currentStatus = liveTelemetry?.status || employee.status || "active";

  const tempVal = liveTelemetry?.sensorData?.temperature ?? employee.sensorData?.temperature ?? "--";
  const humidityVal = liveTelemetry?.sensorData?.humidity ?? employee.sensorData?.humidity ?? "--";
  const soundVal = employee.sensorData?.sound ?? "--";

  const gyro = liveTelemetry?.gyroData || { x: null, y: null, z: null };
  const accel = liveTelemetry?.accelData || { x: null, y: null, z: null };

  const formatVector = (val) => {
    if (val === null || val === undefined) return "N/A";
    return typeof val === "number" ? val.toFixed(2) : val;
  };

  const formatLastReceived = (updatedAt) => {
    if (!updatedAt) return employee.lastCheckIn || "N/A";
    const dateObj = typeof updatedAt?.toDate === "function" ? updatedAt.toDate() : new Date(updatedAt);
    if (isNaN(dateObj.getTime())) return updatedAt || employee.lastCheckIn || "N/A";
    return dateObj.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>
              {firstName} {lastName} <span className={`status-badge status-${currentStatus}`}>
                {currentStatus}
              </span>
            </h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modal-section">
          <h3>Video Feed</h3>
        </div>

        <div className="modal-section">
          <p className="modal-detail-line">
            Last data received: {formatLastReceived(liveTelemetry?.updatedAt)}
          </p>
        </div>

        <div className="modal-section">
          <h3>Sensor Data</h3>
          <div className="modal-sensor-grid">
            <div className="sensor-stat">
              <span className="sensor-label">Temp</span>
              <span className="sensor-value">{tempVal}°F</span>
            </div>
            <div className="sensor-stat">
              <span className="sensor-label">Humidity</span>
              <span className="sensor-value">{humidityVal}%</span>
            </div>
            <div className="sensor-stat">
              <span className="sensor-label">Sound</span>
              <span className="sensor-value">{soundVal} dB</span>
            </div>
          </div>
        </div>

        <div className="modal-section">
          <h3>Gyroscope</h3>
          <div className="modal-sensor-grid">
            <div className="sensor-stat">
              <span className="sensor-label">X Axis</span>
              <span className="sensor-value">{formatVector(gyro.x)}</span>
            </div>
            <div className="sensor-stat">
              <span className="sensor-label">Y Axis</span>
              <span className="sensor-value">{formatVector(gyro.y)}</span>
            </div>
            <div className="sensor-stat">
              <span className="sensor-label">Z Axis</span>
              <span className="sensor-value">{formatVector(gyro.z)}</span>
            </div>
          </div>
        </div>

        <div className="modal-section">
          <h3>Accelerometer</h3>
          <div className="modal-sensor-grid">
            <div className="sensor-stat">
              <span className="sensor-label">X Axis</span>
              <span className="sensor-value">{formatVector(accel.x)}</span>
            </div>
            <div className="sensor-stat">
              <span className="sensor-label">Y Axis</span>
              <span className="sensor-value">{formatVector(accel.y)}</span>
            </div>
            <div className="sensor-stat">
              <span className="sensor-label">Z Axis</span>
              <span className="sensor-value">{formatVector(accel.z)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmployeeDetailModal;