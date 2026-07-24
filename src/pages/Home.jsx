import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  ArrowRight,
  Activity,
  Video,
  AlertTriangle
} from "lucide-react";
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
                Go to Dashboard <ArrowRight size={16} />
              </Link>
            </>
          ) : (
            <>
              <Link to="/signup" className="btn btn-primary">
                Get Started <ArrowRight size={16} />
              </Link>
              <Link to="/login" className="btn btn-secondary">
                Sign In
              </Link>
            </>
          )}
        </div>

        <div className="simple-cards">
          <div className="simple-card">
            <Activity size={22} className="card-icon" />
            <h3>Real-Time Sensor Data</h3>
            <p>Our sensors all come from a 60 dollar kit, but that don't mean we can't get workers some safety.</p>
          </div>

          <div className="simple-card">
            <Video size={22} className="card-icon" />
            <h3>Body Cam</h3>
            <p>Andy will do this manually until he finishes coding by 6pm EST SHARP.</p>
          </div>

          <div className="simple-card">
            <AlertTriangle size={22} className="card-icon" />
            <h3>Worker Safety Alerts</h3>
            <p>We will alert your most of the time, but sometimes marking them as dead is more convenient.</p>
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <p>InductorStick Worker Safety System</p>
      </footer>
    </div>
  );
}

export default Home;