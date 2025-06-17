import React from "react";
import { useNavigate } from "react-router-dom";

type LogoutButtonProps = {
  onLogout: () => void;
};

const LogoutButton: React.FC<LogoutButtonProps> = ({ onLogout }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    onLogout();          // ← powiadamiamy App o wylogowaniu
    navigate("/login");  // ← przekierowujemy na login
  };

  return (
    <button onClick={handleLogout}>
      Wyloguj
    </button>
  );
};

export default LogoutButton;
