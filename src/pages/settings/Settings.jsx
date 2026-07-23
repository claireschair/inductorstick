import { useAuth } from "../../context/AuthContext";
import SupervisorSettings from "./SupervisorSettings";
import WorkerSettings from "./WorkerSettings";

function Settings() {
  const { userProfile } = useAuth();

  if (userProfile?.role === "supervisor") {
    return <SupervisorSettings />;
  }

  return <WorkerSettings />;
}

export default Settings;
