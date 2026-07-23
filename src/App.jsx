import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Dashboard from "./pages/supervisor/Dashboard";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import Settings from "./pages/settings/Settings";
import { useAuth } from "./context/AuthContext";
import "./styles/App.css";

function HomeRoute() {
  const { userProfile } = useAuth();

  if (userProfile?.role === "supervisor") {
    return <Dashboard />;
  }

  return <Home />;
}

function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
      </Routes>
    </>
  );
}

export default App;