import { useTelemetry } from "../context/TelemetryContext";
import "../styles/EmployeeDetailModal.css";

function EmployeeDetailModal({ employee, onClose }) {
  const { getDeviceTelemetry } = useTelemetry();
  const liveTelemetry = getDeviceTelemetry(employee.id);

  const { firstName, lastName, zone, position } = employee;

  const currentStatus = liveTelemetry?.status || employee.status || "active";
  const isCheckingIn = liveTelemetry?.checkingIn || false;
  const timeSinceCheckIn = liveTelemetry?.timeSinceLastCheckIn ?? null;

  const tempVal = liveTelemetry?.sensorData?.temperature ?? employee.sensorData?.temperature ?? "--";
  const humidityVal = liveTelemetry?.sensorData?.humidity ?? employee.sensorData?.humidity ?? "--";
  const soundVal = employee.sensorData?.sound ?? "--";

  const gyro = liveTelemetry?.gyroData || { x: null, y: null, z: null };
  const accel = liveTelemetry?.accelData || { x: null, y: null, z: null };

  const formatVector = (val) => {
    if (val === null || val === undefined) return "N/A";
    return typeof val === "number" ? val.toFixed(2) : val;
  };

  const formatSeconds = (sec) => {
    if (sec === null || sec === undefined) return employee.lastCheckIn || "N/A";
    if (sec < 60) return `${sec}s ago`;
    const mins = Math.floor(sec / 60);
    const remainingSec = sec % 60;
    return `${mins}m ${remainingSec}s ago`;
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>
              {firstName} {lastName}
            </h2>
            <div className="badge-row">
              <span className={`status-badge status-${currentStatus}`}>
                {currentStatus}
              </span>
              {isCheckingIn && (
                <span className="status-badge status-checking-in">
                  Checking In
                </span>
              )}
              {liveTelemetry && (
                <span className="status-badge status-live">
                  Live Tag #{employee.id}
                </span>
              )}
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modal-section">
          <h3>Location</h3>
          <div className="facility-map">
            <div
              className="facility-marker"
              style={{
                left: `${liveTelemetry?.position?.x ?? position?.x ?? 50}%`,
                top: `${liveTelemetry?.position?.y ?? position?.y ?? 50}%`,
              }}
            />
          </div>
          <p className="modal-zone">{zone || "Zone A"}</p>
        </div>

        <div className="modal-section">
          <h3>Check-In & Hardware Status</h3>
          <p className="modal-detail-line">
            Time since last check-in: {formatSeconds(timeSinceCheckIn)}
          </p>
        </div>

        <div className="modal-section">
          <h3>Sensor Readings</h3>
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
          <h3>Gyroscope (IMU)</h3>
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
          <h3>Accelerometer (IMU)</h3>
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