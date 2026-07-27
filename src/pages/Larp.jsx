import { useState, useEffect, useCallback } from "react";
import "../styles/Larp.css";

function Larp() {
  const [workerId, setWorkerId] = useState("");
  const [status, setStatus] = useState("idle");
  const [activeId, setActiveId] = useState("");

  const handleKeyPress = useCallback((num) => {
    if (status === "success") {
      setStatus("idle");
      setWorkerId(num.toString());
      return;
    }
    setWorkerId((prev) => (prev.length < 8 ? prev + num : prev));
  }, [status]);

  const handleDelete = useCallback(() => {
    if (status === "success") {
      setStatus("idle");
      setWorkerId("");
      return;
    }
    setWorkerId((prev) => prev.slice(0, -1));
  }, [status]);

  const handleClear = useCallback(() => {
    setWorkerId("");
    setStatus("idle");
  }, []);

  const handleSubmit = useCallback(() => {
    if (!workerId) return;
    setActiveId(workerId);
    setStatus("verifying");
    setTimeout(() => {
      setStatus("success");
    }, 2500);
  }, [workerId]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key >= "0" && e.key <= "9") {
        handleKeyPress(e.key);
      } else if (e.key === "Backspace") {
        handleDelete();
      } else if (e.key === "Escape") {
        handleClear();
      } else if (e.key === "Enter") {
        if (workerId && status === "idle") {
          handleSubmit();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [workerId, status, handleKeyPress, handleDelete, handleClear, handleSubmit]);

  return (
    <div className="larp-simple-container">
      <div className="larp-top-row">
        <span className="larp-title">Worker Tag Charger</span>
      </div>

      <div className="larp-main-layout">
        <div className="larp-screen">
          {status === "idle" && (
            <div>
              <div className="larp-label">Worker ID:</div>
              <div className="larp-id-display">
                {workerId || "Enter ID..."}
              </div>
            </div>
          )}

          {status === "verifying" && (
            <div className="larp-status-msg">
              Checking worker #{activeId}...
            </div>
          )}

          {status === "success" && (
            <div>
              <div className="larp-success-msg">
                Tag for worker #{activeId} is 100% charged.
              </div>
              <button className="larp-reset-btn" onClick={handleClear}>
                Reset
              </button>
            </div>
          )}
        </div>

        <div className="larp-pad">
          <div className="larp-grid">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                className="larp-btn"
                onClick={() => handleKeyPress(num)}
                disabled={status === "verifying"}
              >
                {num}
              </button>
            ))}
            <button
              className="larp-btn larp-btn-clr"
              onClick={handleClear}
              disabled={status === "verifying"}
            >
              Clear
            </button>
            <button
              className="larp-btn"
              onClick={() => handleKeyPress(0)}
              disabled={status === "verifying"}
            >
              0
            </button>
            <button
              className="larp-btn larp-btn-del"
              onClick={handleDelete}
              disabled={status === "verifying"}
            >
              Del
            </button>
          </div>
          <button
            className="larp-submit-btn"
            onClick={handleSubmit}
            disabled={!workerId || status === "verifying"}
          >
            {status === "verifying" ? "Loading..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Larp;
