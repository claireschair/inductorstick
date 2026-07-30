import { Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import SupervisorDashboard from "./pages/supervisor/SupervisorDashboard";
import WorkerDashboard from "./pages/worker/WorkerDashboard";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import Settings from "./pages/settings/Settings";
import Profile from "./pages/Profile";
import Larp from "./pages/Larp";
import SupervisorAlertBanner from "./components/SupervisorAlertBanner";
import "./styles/App.css";
import AudioTest from "./components/AudioTest";
import AudioClassifier from "./components/AudioClassifier";

function App() {
  const location = useLocation();

  return (
    <div className="app-container">
      {location.pathname !== "/larp" &&
       location.pathname !== "/test-audio" &&
       location.pathname !== "/audio-monitor" && <Navbar />}

      <SupervisorAlertBanner />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/supervisor/dashboard" element={<SupervisorDashboard />} />
        <Route path="/worker/dashboard" element={<WorkerDashboard />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/larp" element={<Larp />} />

        <Route path="/audio-monitor" element={<AudioClassifier />} />
        <Route path="/test-audio" element={<AudioTest />} />
      </Routes>
    </div>
  );
}

export default App;