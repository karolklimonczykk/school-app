import React, { useState, useCallback }  from "react";
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Schools from "./pages/Schools";
import LogoutButton from "./components/LogoutButton";
import SchoolDetails from "./pages/SchoolDetails";

const App: React.FC = () => {
  // isLoggedIn w stanie Reacta
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem("token"));

  // Aktualizuj stan, jeśli token się zmieni (np. przez login/logout)
  const handleLogin = useCallback(() => setIsLoggedIn(true), []);
  const handleLogout = useCallback(() => setIsLoggedIn(false), []);

  return (
    <Router>
      <nav>
        {!isLoggedIn ? (
          <>
            <Link to="/login">Logowanie</Link> |{" "}
            <Link to="/register">Rejestracja</Link>
          </>
        ) : (
          <>
            <Link to="/schools">Szkoły</Link> |{" "}
            <LogoutButton onLogout={handleLogout} />
          </>
        )}
      </nav>
      <Routes>
        <Route
          path="/schools"
          element={
            isLoggedIn ? <Schools /> : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/login"
          element={
            !isLoggedIn ? <Login onLogin={handleLogin} /> : <Navigate to="/schools" replace />
          }
        />
        <Route
          path="/register"
          element={
            !isLoggedIn ? <Register /> : <Navigate to="/schools" replace />
          }
        />
        <Route path="*" element={<Navigate to={isLoggedIn ? "/schools" : "/login"} replace />} />
        <Route
          path="/schools/:id"
          element={
          isLoggedIn ? <SchoolDetails /> : <Navigate to="/login" replace />
        }
        />
      </Routes>
    </Router>
  );
};

export default App;
