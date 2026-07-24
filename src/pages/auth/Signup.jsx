import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import PasswordInput from "../../components/PasswordInput";
import "../../styles/AuthForm.css";

function Signup() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupType, setSignupType] = useState("create");
  const [companyName, setCompanyName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signup, setUserProfile } = useAuth();
  const navigate = useNavigate();

  function generateCode() {
    return "IND-" + Math.floor(1000 + Math.random() * 9000);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let finalCompanyName = companyName.trim();
      let finalCode = joinCode.trim().toUpperCase();

      if (signupType === "create") {
        if (!finalCompanyName) {
          setError("Please enter a company name.");
          setLoading(false);
          return;
        }
        finalCode = generateCode();
      } else {
        if (!finalCode) {
          setError("Please enter a company join code.");
          setLoading(false);
          return;
        }

        const companySnap = await getDoc(doc(db, "companies", finalCode));
        if (!companySnap.exists()) {
          setError("Invalid company join code. Please check with your supervisor.");
          setLoading(false);
          return;
        }
        finalCompanyName = companySnap.data().companyName || "Company";
      }

      const userCredential = await signup(email, password);

      const profileData = {
        firstName,
        lastName,
        email,
        companyName: finalCompanyName,
        companyCode: finalCode,
        role: signupType === "create" ? "supervisor" : "worker",
        isCreator: signupType === "create",
      };

      if (signupType === "create") {
        await setDoc(doc(db, "companies", finalCode), {
          companyName: finalCompanyName,
          joinCode: finalCode,
          createdBy: userCredential.user.uid,
          createdAt: new Date().toISOString(),
          tempMax: 85,
          tempMin: 50,
          soundMax: 90,
          humidityMax: 80,
          checkInInterval: 15,
        });
      }

      await setDoc(doc(db, "users", userCredential.user.uid), profileData);
      setUserProfile(profileData);

      navigate("/");
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError("That email is already registered.");
      } else {
        setError("Failed to create an account. Please try again.");
      }
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

        <PasswordInput
          id="signup-password"
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />

        <fieldset className="role-select">
          <legend>Company Action</legend>
          <div className="role-options">
            <label className={`role-option ${signupType === "create" ? "role-option-selected" : ""}`}>
              <input
                type="radio"
                name="signupType"
                value="create"
                checked={signupType === "create"}
                onChange={() => setSignupType("create")}
                className="role-radio-input"
              />
              <span className="role-radio-dot" aria-hidden="true" />
              Create a Company
            </label>
            <label className={`role-option ${signupType === "join" ? "role-option-selected" : ""}`}>
              <input
                type="radio"
                name="signupType"
                value="join"
                checked={signupType === "join"}
                onChange={() => setSignupType("join")}
                className="role-radio-input"
              />
              <span className="role-radio-dot" aria-hidden="true" />
              Join a Company
            </label>
          </div>
        </fieldset>

        {signupType === "create" ? (
          <label htmlFor="signup-company-name" className="field-label">
            New Company Name
            <input
              id="signup-company-name"
              type="text"
              placeholder="e.g. The Inductors"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
          </label>
        ) : (
          <label htmlFor="signup-join-code" className="field-label">
            Company Join Code
            <input
              id="signup-join-code"
              type="text"
              placeholder="e.g. IND-8924"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              required
            />
          </label>
        )}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Creating account..." : signupType === "create" ? "Create & Sign Up" : "Join & Sign Up"}
        </button>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}

export default Signup;