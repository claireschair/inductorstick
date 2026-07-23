import "../styles/EmployeeGridItem.css";

function EmployeeGridItem({ employee, onClick }) {
  const { firstName, lastName, checkedIn, zone, status, lastCheckIn, lastCheckOut, sensorData } = employee;

  if (!checkedIn) {
    return (
      <div className="employee-card employee-card-inactive">
        <div className="employee-card-header">
          <h3>
            {firstName} {lastName}
          </h3>
          <span className="status-badge status-inactive">not checked in</span>
        </div>
        <p className="employee-checkin">Last checked out: {lastCheckOut}</p>
      </div>
    );
  }

  return (
    <button className="employee-card employee-card-clickable" onClick={onClick}>
      <div className="employee-card-header">
        <h3>
          {firstName} {lastName}
        </h3>
        <span className={`status-badge status-${status}`}>{status}</span>
      </div>

      <p className="employee-zone">{zone}</p>
      <p className="employee-checkin">Last check-in: {lastCheckIn}</p>

      <div className="sensor-readings">
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
    </button>
  );
}

export default EmployeeGridItem;