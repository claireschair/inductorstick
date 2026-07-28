import { createContext, useContext } from "react";

export const TelemetryContext = createContext({});

export function useTelemetry() {
  return useContext(TelemetryContext);
}
