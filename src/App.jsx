import { Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import SupervisorDashboard from "./pages/supervisor/SupervisorDashboard";
import WorkerDashboard from "./pages/worker/WorkerDashboard";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import Settings from "./pages/settings/Settings";
import Profile from "./pages/Profile";
import Larp from "./pages/Larp";
import { useAuth } from "./context/AuthContext";
import SupervisorAlertBanner from "./components/SupervisorAlertBanner";
import "./styles/App.css";

function DashboardRoute() {
  const { userProfile } = useAuth();

  if (userProfile?.role === "supervisor") {
    return <SupervisorDashboard />;
  } else {
    return <WorkerDashboard />;
  }
}

function App() {
  const location = useLocation();

  return (
    <div className="app-container">
      {location.pathname !== "/larp" && <Navbar />}
      <SupervisorAlertBanner />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<DashboardRoute />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/larp" element={<Larp />} />
      </Routes>
    </div>
  );
}

export default App;
