import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/Navbar.css";

function Navbar() {
  const { currentUser, userProfile } = useAuth();

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <Link to="/" className="navbar-brand">
          InductorStick
        </Link>
      </div>
      <div className="navbar-links">
        {currentUser ? (
          <>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/settings">Settings</Link>
            <Link to="/profile">Profile</Link>
            {userProfile?.role && (
              <span className={`role-badge role-${userProfile.role}`}>
                {userProfile.role === "supervisor" ? "Supervisor" : "Employee"}
              </span>
            )}
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/signup">Sign Up</Link>
          </>
        )}
      </div>
    </nav>
  );
}

export default Navbar;