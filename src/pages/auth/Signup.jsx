import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import PasswordInput from "../../components/PasswordInput";
import "../../styles/AuthForm.css";

function Signup() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [role, setRole] = useState("worker");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const userCredential = await signup(email, password);
      await setDoc(doc(db, "users", userCredential.user.uid), {
        firstName,
        lastName,
        email,
        companyName,
        role,
      });
      navigate("/");
    } catch (err) {
      setError(
        "Failed to create an account. " +
          (err.code === "auth/email-already-in-use"
            ? "That email is already registered."
            : "Please try again.")
      );
      console.error(err);
    }
    setLoading(false);
  }

  return (
    <div className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>Sign Up</h1>
        {error && <p className="auth-error">{error}</p>}

        <div className="name-row">
          <label htmlFor="signup-first-name" className="field-label">
            First Name
            <input
              id="signup-first-name"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </label>
          <label htmlFor="signup-last-name" className="field-label">
            Last Name
            <input
              id="signup-last-name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </label>
        </div>

        <label htmlFor="signup-email" className="field-label">
          Email
          <input
            id="signup-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label htmlFor="signup-company" className="field-label">
          Company Name
          <input
            id="signup-company"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
          />
        </label>
        <PasswordInput
          id="signup-password"
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />

        <fieldset className="role-select">
          <legend>I am a</legend>
          <div className="role-options">
            <label className={`role-option ${role === "worker" ? "role-option-selected" : ""}`}>
              <input
                type="radio"
                name="role"
                value="worker"
                checked={role === "worker"}
                onChange={() => setRole("worker")}
                className="role-radio-input"
              />
              <span className="role-radio-dot" aria-hidden="true" />
              Worker
            </label>
            <label className={`role-option ${role === "supervisor" ? "role-option-selected" : ""}`}>
              <input
                type="radio"
                name="role"
                value="supervisor"
                checked={role === "supervisor"}
                onChange={() => setRole("supervisor")}
                className="role-radio-input"
              />
              <span className="role-radio-dot" aria-hidden="true" />
              Supervisor
            </label>
          </div>
        </fieldset>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Creating account..." : "Sign Up"}
        </button>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}

export default Signup;