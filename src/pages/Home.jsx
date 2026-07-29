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
          Brought to you by the amazing, glorious, cool Inductors.
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

        <div className="simple-cards">
          <div className="simple-card">
            <h3>Live Sensor Data</h3>
            <p>Our sensors all come from a 60 dollar kit, but that don't mean we can't get workers some safety.</p>
          </div>

          <div className="simple-card">
            <h3>Body Cam</h3>
            <p>Andy will manually take pictures and upload them until he finishes coding by 6pm EST SHARP.</p>
          </div>

          <div className="simple-card">
            <h3>Safety Alerts</h3>
            <p>We will alert you most of the time, but marking them as dead is sometimes more convenient.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;