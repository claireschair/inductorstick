import { useAuth } from "../context/AuthContext";
import { useTelemetry } from "../context/TelemetryContext";
import "../styles/SupervisorAlertBanner.css";

function SupervisorAlertBanner() {
  const { userProfile } = useAuth();
  const { alerts, dismissAlert } = useTelemetry();

  if (userProfile?.role !== "supervisor" || !alerts || alerts.length === 0) {
    return null;
  }

  const renderAlertMessage = (alert) => {
    if (alert.status === "panic") {
      return (
        <span>
          <strong>{alert.workerName}</strong> needs emergency services - CALL 911!
        </span>
      );
    }
    if (alert.status === "unresponsive") {
      return (
        <span>
          <strong>{alert.workerName}</strong> is unresponsive.
        </span>
      );
    }
    if (alert.status === "superivsor_call") {
      return (
        <span>
          <strong>{alert.workerName}</strong> needs supervisor assistance.
        </span>
      );
    }
  };

  return (
    <div className="alert-banner-stack">
      {alerts.map((alert) => (
        <div
          key={alert.deviceId}
          className={`alert-banner alert-banner-${alert.status}`}
        >
          {renderAlertMessage(alert)}
          <button
            className="alert-banner-dismiss"
            onClick={() => dismissAlert(alert.deviceId)}
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}

export default SupervisorAlertBanner;