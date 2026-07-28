import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, updateDoc } from "firebase/firestore";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import PasswordInput from "../components/PasswordInput";
import "../styles/Settings.css";
import "../styles/Profile.css";

function Profile() {
  const { currentUser, userProfile, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState(userProfile?.firstName || "");
  const [lastName, setLastName] = useState(userProfile?.lastName || "");
  const [profileMessage, setProfileMessage] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  async function handleProfileSave(e) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMessage("");
    try {
      await updateDoc(doc(db, "users", currentUser.uid), {
        firstName,
        lastName,
      });
      if (refreshProfile) {
        await refreshProfile();
      }
      setProfileMessage("Profile updated.");
      setTimeout(() => setProfileMessage(""), 3000);
    } catch (err) {
      console.error(err);
      setProfileMessage("Failed to update profile.");
    }
    setSavingProfile(false);
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    setPasswordError("");
    setPasswordMessage("");
    setSavingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setPasswordMessage("Password updated.");
      setTimeout(() => setPasswordMessage(""), 3000);
    } catch (err) {
      console.error(err);
      setPasswordError("Failed to update password. Check your current password.");
    }
    setSavingPassword(false);
  }

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Profile</h1>
      </div>

      <div className="settings-card">
        <h2>Account Information</h2>
        <p className="modal-detail-line">
          <strong>ID:</strong> <span className="company-code-value">#{userProfile?.id ?? "N/A"}</span>
        </p>
        <p className="modal-detail-line">
          <strong>Email:</strong> {currentUser?.email}
        </p>
        <p className="modal-detail-line">
          <strong>Role:</strong> {userProfile?.role === "supervisor" ? "Supervisor" : "Employee"}
        </p>
      </div>

      <div className="settings-card">
        <h2>Change Name</h2>
        <form onSubmit={handleProfileSave} className="profile-form">
          <div className="name-fields">
            <label htmlFor="profile-first-name" className="field-label">
              First Name
              <input
                id="profile-first-name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </label>
            <label htmlFor="profile-last-name" className="field-label">
              Last Name
              <input
                id="profile-last-name"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </label>
          </div>
          <div className="profile-save-row">
            <button type="submit" className="btn-primary" disabled={savingProfile}>
              {savingProfile ? "Saving..." : "Save Changes"}
            </button>
            {profileMessage && <span className="save-status">{profileMessage}</span>}
          </div>
        </form>
      </div>

      <div className="settings-card">
        <h2>Change Password</h2>
        <form onSubmit={handlePasswordChange} className="profile-form">
          {passwordError && <p className="auth-error">{passwordError}</p>}
          <PasswordInput
            id="profile-current-password"
            label="Current Password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <PasswordInput
            id="profile-new-password"
            label="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={6}
            required
          />
          <div className="profile-save-row">
            <button type="submit" className="btn-primary" disabled={savingPassword}>
              {savingPassword ? "Updating..." : "Update Password"}
            </button>
            {passwordMessage && <span className="save-status">{passwordMessage}</span>}
          </div>
        </form>
      </div>

      <div className="settings-card">
        <h2>Session</h2>
        <div className="inline-actions">
          <button className="btn-danger" onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}

export default Profile;