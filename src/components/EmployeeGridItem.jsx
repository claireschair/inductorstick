import { useTelemetry } from "../context/TelemetryContext";
import "../styles/EmployeeGridItem.css";

function EmployeeGridItem({ employee, onClick }) {
  const { getDeviceTelemetry } = useTelemetry();
  const liveTelemetry = getDeviceTelemetry(employee.id);

  const { firstName, lastName, checkedIn, lastCheckIn, lastCheckOut, sensorData } = employee;

  const currentStatus = liveTelemetry?.status || employee.status || "active";
  const isCheckingIn = liveTelemetry?.checkingIn || false;

  const tempVal = liveTelemetry?.sensorData?.temperature ?? sensorData?.temperature ?? "--";
  const humidityVal = liveTelemetry?.sensorData?.humidity ?? sensorData?.humidity ?? "--";
  const soundVal = sensorData?.sound ?? "--";

  const formatLastReceived = (updatedAt) => {
    if (!updatedAt) return lastCheckIn || "N/A";
    const dateObj = typeof updatedAt?.toDate === "function" ? updatedAt.toDate() : new Date(updatedAt);
    if (isNaN(dateObj.getTime())) return updatedAt || lastCheckIn || "N/A";
    return dateObj.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
  };

  if (!checkedIn) {
    let displayCheckOut = lastCheckOut;
    if (!displayCheckOut && employee.lastCheckOutTime) {
      const d = new Date(employee.lastCheckOutTime);
      if (!isNaN(d.getTime())) {
        const dateStr = d.toLocaleDateString([], { month: "short", day: "numeric" });
        const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        displayCheckOut = `${dateStr}, ${timeStr}`;
      }
    }
    if (!displayCheckOut) {
      displayCheckOut = "N/A";
    }

    return (
      <div className="employee-card employee-card-inactive">
        <div className="employee-card-header">
          <h3>
            {firstName} {lastName}
          </h3>
        </div>
        <p className="employee-checkin">Last checked out: {displayCheckOut}</p>
      </div>
    );
  }

  return (
    <button className="employee-card employee-card-clickable" onClick={onClick}>
      <div className="employee-card-header">
        <h3>
          {firstName} {lastName}
        </h3>
        <div className="badge-row">
          <span className={`status-badge status-${currentStatus}`}>{currentStatus}</span>
          {isCheckingIn && (
            <span className="status-badge status-checking-in">
              Ping
            </span>
          )}
        </div>
      </div>

      <p className="employee-checkin">
        Last received: {formatLastReceived(liveTelemetry?.updatedAt)}
      </p>

      <div className="sensor-readings">
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
    </button>
  );
}

export default EmployeeGridItem;