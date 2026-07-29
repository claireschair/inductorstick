import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/Home.css";

function Home() {
  const { currentUser } = useAuth();

  return (
    <div className="home-container">
      <section className="hero-section">
        <h1 className="hero-title">InductorStick</h1>
        <p className="hero-subtitle">
          Ainsley, Andy, Atharv, Claire, and Nikhil
        </p>

        <div className="hero-actions">
          {currentUser ? (
            <>
              <Link to="/dashboard" className="btn btn-primary">
                Go to Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link to="/signup" className="btn btn-primary">
                Sign Up
              </Link>
              <Link to="/login" className="btn btn-secondary">
                Log In
              </Link>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default Home;