import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import SupervisorDashboard from "./pages/supervisor/SupervisorDashboard";
import WorkerDashboard from "./pages/worker/WorkerDashboard";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import Settings from "./pages/settings/Settings";
import Profile from "./pages/Profile";
import { useAuth } from "./context/AuthContext";
import "./styles/App.css";

function HomeRoute() {
  const { userProfile } = useAuth();

  if (userProfile?.role === "supervisor") {
    return <SupervisorDashboard />;
  }

  return <WorkerDashboard />;
}

function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
      </Routes>
    </>
  );
}

export default App;