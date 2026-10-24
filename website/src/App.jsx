import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Menu from "./pages/Menu";
import Borrow from "./pages/Borrow";
import Fine from "./pages/Fine";
import "./index.css";

function getSavedUser() {
  try { return JSON.parse(localStorage.getItem("user") || "null"); }
  catch { return null; }
}

export default function App() {
  const [user, setUser] = useState(getSavedUser);
  const hasSession = Boolean(user && localStorage.getItem("token"));
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={hasSession ? "/menu" : "/login"} replace />} />
        <Route path="/login" element={hasSession ? <Navigate to="/menu" replace /> : <Login setUser={setUser} />} />
        <Route path="/menu" element={hasSession ? <Menu user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
        <Route path="/borrow" element={hasSession ? <Borrow user={user} /> : <Navigate to="/login" replace />} />
        <Route path="/fine" element={hasSession ? <Fine user={user} /> : <Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to={hasSession ? "/menu" : "/login"} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
