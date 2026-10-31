import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import App from "./App";
import "./index.css";

// Register the service worker and automatically apply available app updates.
registerSW({
  immediate: true,

  onRegistered(registration) {
    console.log("STEP SW: Service Worker registered!", registration);
  },

  onRegisterError(error) {
    console.error("STEP SW ERROR:", error);
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
