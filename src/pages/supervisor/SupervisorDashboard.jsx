import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, doc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import EmployeeGridItem from "../../components/EmployeeGridItem";
import EmployeeDetailModal from "../../components/EmployeeDetailModal";
import "../../styles/SupervisorDashboard.css";

function SupervisorDashboard() {
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [announcementInput, setAnnouncementInput] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [_activeAnnouncement, setActiveAnnouncement] = useState(null);

  const { userProfile } = useAuth();

  useEffect(() => {
    const unsubAnnouncement = onSnapshot(
      doc(db, "announcements", "current"),
      (docSnap) => {
        if (docSnap.exists()) {
          setActiveAnnouncement(docSnap.data());
        } else {
          setActiveAnnouncement(null);
        }
      },
      (err) => {
        console.error("Error fetching announcement:", err);
      }
    );

    return () => unsubAnnouncement();
  }, []);

  useEffect(() => {
    if (!userProfile?.companyCode) {
      setLoading(false);
      return;
    }

    const usersRef = collection(db, "users");
    const qUsers = query(
      usersRef,
      where("companyCode", "==", userProfile.companyCode),
      where("role", "==", "worker")
    );

    const unsubUsers = onSnapshot(
      qUsers,
      (snapshot) => {
        const list = [];
        snapshot.forEach((docSnap) => {
          list.push({
            docId: docSnap.id,
            ...docSnap.data(),
          });
        });
        setEmployees(list);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      }
    );

    const sessionsRef = collection(db, "sessions");
    const unsubSessions = onSnapshot(
      sessionsRef,
      (snapshot) => {
        const list = [];
        snapshot.forEach((docSnap) => {
          list.push({
            id: docSnap.id,
            ...docSnap.data(),
          });
        });
        setSessions(list);
      },
      (err) => {
        console.error("Error fetching sessions in SupervisorDashboard:", err);
      }
    );

    return () => {
      unsubUsers();
      unsubSessions();
    };
  }, [userProfile]);

  const handlePushAnnouncement = async (e) => {
    e.preventDefault();
    const textToPush = announcementInput.trim();
    if (!textToPush) return;

    setPublishing(true);
    setAnnouncementMessage("");

    try {
      const creatorName = userProfile?.firstName
        ? `${userProfile.firstName} ${userProfile.lastName || ""}`.trim()
        : "Supervisor";

      await setDoc(
        doc(db, "announcements", "current"),
        {
          text: textToPush,
          active: true,
          updatedAt: new Date().toISOString(),
          createdBy: creatorName,
        },
        { merge: true }
      );

      try {
        await fetch("http://localhost:6767/api/announcement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ announcement: textToPush }),
        });
      } catch (e) {
        console.warn("Failed to broadcast to local endpoint:", e);
      }

      setAnnouncementInput("");
      setAnnouncementMessage("Successfully announced.");
      setTimeout(() => setAnnouncementMessage(""), 3500);
    } catch (err) {
      console.error("Failed to push announcement:", err);
      setAnnouncementMessage("Failed to push announcement.");
    }
    setPublishing(false);
  };

  const employeesWithSessionData = employees.map((employee) => {
    const workerSessions = sessions.filter(
      (s) =>
        s.userUid === employee.docId ||
        (employee.id !== undefined && Number(s.userId) === Number(employee.id))
    );

    workerSessions.sort((a, b) => {
      const timeA = new Date(a.checkOutTime || a.timestamp || a.checkInTime || a.createdAt || 0).getTime();
      const timeB = new Date(b.checkOutTime || b.timestamp || b.checkInTime || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    const latestSession = workerSessions[0];

    let computedCheckOut = null;
    if (latestSession) {
      const isoTime = latestSession.checkOutTime || latestSession.timestamp || latestSession.createdAt;
      if (isoTime) {
        const d = new Date(isoTime);
        if (!isNaN(d.getTime())) {
          const dateStr = d.toLocaleDateString([], { month: "short", day: "numeric" });
          const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
          computedCheckOut = `${dateStr}, ${timeStr}`;
        }
      }
      if (!computedCheckOut && latestSession.date && (latestSession.checkOut || latestSession.timeDisplay)) {
        computedCheckOut = `${latestSession.date}, ${latestSession.checkOut || latestSession.timeDisplay}`;
      } else if (!computedCheckOut && (latestSession.checkOut || latestSession.timeDisplay)) {
        computedCheckOut = latestSession.checkOut || latestSession.timeDisplay;
      }
    }

    const computedCheckIn =
      employee.lastCheckIn ||
      (latestSession
        ? latestSession.checkIn ||
          (latestSession.checkInTime
            ? new Date(latestSession.checkInTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
            : null)
        : null);

    return {
      ...employee,
      lastCheckOut: computedCheckOut || employee.lastCheckOut,
      lastCheckIn: computedCheckIn || employee.lastCheckIn,
    };
  });

  const activeEmployees = employeesWithSessionData.filter((employee) => employee.checkedIn);
  const inactiveEmployees = employeesWithSessionData.filter((employee) => !employee.checkedIn);


  return (
    <div className="supervisor-page">
      <div className="announcement-section settings-card">
        <h2>Global Announcement</h2>
        <form onSubmit={handlePushAnnouncement} className="announcement-form">
          <div className="announcement-input-group">
            <input
              type="text"
              className="announcement-input"
              placeholder="Stay brief and concise..."
              value={announcementInput}
              onChange={(e) => setAnnouncementInput(e.target.value)}
            />
            <button
              type="submit"
              className="btn-primary"
              disabled={publishing || !announcementInput.trim()}
            >
              {publishing ? "Announcing..." : "Announce"}
            </button>
          </div>
          {announcementMessage && <p className="announcement-feedback">{announcementMessage}</p>}
        </form>
      </div>

      <h1>Team Overview</h1>

      {loading ? (
        <p>Loading team members...</p>
      ) : employeesWithSessionData.length === 0 ? (
        <div className="empty-state" style={{ padding: "20px", background: "#ffffff", borderRadius: "0px", border: "1px solid var(--color-secondary)" }}>
          <p style={{ margin: 0, color: "var(--color-secondary)" }}>
            No workers found in company {userProfile?.companyCode || ""}.
          </p>
        </div>
      ) : (
        <>
          <h2 className="section-heading">Checked In ({activeEmployees.length})</h2>
          {activeEmployees.length === 0 ? (
            <p style={{ color: "var(--color-secondary)", fontSize: "0.9rem" }}>No workers currently checked in.</p>
          ) : (
            <div className="employee-grid">
              {activeEmployees.map((employee) => (
                <EmployeeGridItem
                  key={employee.docId || employee.id}
                  employee={employee}
                  onClick={() => setSelectedEmployee(employee)}
                />
              ))}
            </div>
          )}

          <h2 className="section-heading">Not Checked In ({inactiveEmployees.length})</h2>
          {inactiveEmployees.length === 0 ? (
            <p style={{ color: "var(--color-secondary)", fontSize: "0.9rem" }}>All team workers are checked in.</p>
          ) : (
            <div className="employee-grid">
              {inactiveEmployees.map((employee) => (
                <EmployeeGridItem
                  key={employee.docId || employee.id}
                  employee={employee}
                  onClick={() => setSelectedEmployee(employee)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {selectedEmployee && (
        <EmployeeDetailModal
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
    </div>
  );
}

export default SupervisorDashboard;