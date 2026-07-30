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
import AudioTest from './components/AudioTest'; //uncommitted
import AudioClassifier from "./components/AudioClassifier";

function App() {
  const location = useLocation();
  const hideLayoutPaths = ["/login", "/signup", "/larp", "/test-audio"];
  const shouldShowLayout = !hideLayoutPaths.includes(location.pathname);

  return (
    <div className="app-container">
      {/* Hide navbar on larp and test-audio if you want a clean view */}
      {location.pathname !== "/larp" && location.pathname !== "/test-audio" && <Navbar />}
      
      <SupervisorAlertBanner />
      
      {/* Renders only on core app views */}
      {shouldShowLayout && <AudioClassifier />}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/supervisor/dashboard" element={<SupervisorDashboard />} />
        <Route path="/worker/dashboard" element={<WorkerDashboard />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/larp" element={<Larp />} />
        
        {/*register new route*/}
        <Route path="/test-audio" element={<AudioTest />} />
      </Routes>
    </div>
  );
}

export default App;