import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Login from "../pages/Login";
import Register from "../pages/Register";
import Schools from "../pages/Schools";
import Classes from "../pages/Classes";
import Students from "../pages/Students";
import TestTemplates from "../pages/TestTemplates";
const AppRoutes: React.FC = () => {
  const { isLoggedIn } = useAuth();

  return (
    <Routes>
      <Route path="/schools" element={isLoggedIn ? <Schools /> : <Navigate to="/login" replace />} />
      <Route path="/classes" element={isLoggedIn ? <Classes /> : <Navigate to="/login" replace />} />
      <Route path="/students" element={isLoggedIn ? <Students /> : <Navigate to="/login" replace />} />
      <Route path="/templates" element={isLoggedIn ? <TestTemplates /> : <Navigate to="/login" replace />} />
      <Route path="/login" element={!isLoggedIn ? <Login/> : <Navigate to="/schools" replace />} />
      <Route path="/register" element={!isLoggedIn ? <Register /> : <Navigate to="/schools" replace />} />
      <Route path="*" element={<Navigate to={isLoggedIn ? "/schools" : "/login"} replace />} />
    </Routes>
  );
};

export default AppRoutes;
