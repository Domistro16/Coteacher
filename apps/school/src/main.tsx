import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AccountGate } from "../../shared/AccountGate";
import { SchoolPortal } from "./SchoolPortal";
import "../../student/src/styles.css";
import "./school-theme.css";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AccountGate kind="school">
      {(state, refresh, config) => (
        <SchoolPortal state={state} refresh={refresh} config={config} />
      )}
    </AccountGate>
  </StrictMode>,
);
