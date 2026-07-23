import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/Navbar.css";

function Navbar() {
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

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
            <Link to="/">Dashboard</Link>
            <Link to="/settings">Settings</Link>
            {userProfile?.role && (
              <span className={`role-badge role-${userProfile.role}`}>
                {userProfile.role === "supervisor" ? "Supervisor" : "Employee"}
              </span>
            )}
            <span className="navbar-email">{currentUser.email}</span>
            <button className="btn-link" onClick={handleLogout}>
              Log Out
            </button>
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