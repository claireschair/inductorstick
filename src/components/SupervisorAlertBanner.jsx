import { useAuth } from "../context/AuthContext";
import { useTelemetry } from "../context/TelemetryContext";
import "../styles/SupervisorAlertBanner.css";

function SupervisorAlertBanner() {
  const { userProfile } = useAuth();
  const { alerts, dismissAlert } = useTelemetry();

  if (userProfile?.role !== "supervisor" || alerts.length === 0) {
    return null;
  }

  return (
    <div className="alert-banner-stack">
      {alerts.map((alert) => (
        <div
          key={alert.deviceId}
          className={`alert-banner alert-banner-${alert.status}`}
        >
          {alert.status === "panic" ? (
            <span>
              <strong>{alert.workerName}</strong> needs help in {alert.zone} — call 911
            </span>
          ) : (
            <span>
              <strong>{alert.workerName}</strong> needs supervisor assistance in {alert.zone}
            </span>
          )}
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