import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { userProfile, currentUser } = useAuth();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (userProfile?.role === "supervisor") {
    return <Navigate to="/supervisor/dashboard" replace />;
  }

  if (userProfile?.role === "worker") {
    return <Navigate to="/worker/dashboard" replace />;
  }

  return (
    <div style={{ padding: "2rem", textAlign: "center", color: "white" }}>
      Loading dashboard...
    </div>
  );
}
