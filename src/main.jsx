import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./styles/index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthProvider";
import { TelemetryProvider } from "./context/TelemetryProvider";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <TelemetryProvider>
          <App />
        </TelemetryProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);