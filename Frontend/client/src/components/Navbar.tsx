import React from "react";
import { Link } from "react-router-dom";
import LogoutButton from "./LogoutButton";
import { useAuth } from "../context/AuthContext";

const Navbar: React.FC = () => {
  const { isLoggedIn, logout } = useAuth();

  return (
    <nav style={{ marginBottom: "20px" }}>
      {!isLoggedIn ? (
        <>
          <Link to="/login">Logowanie</Link> |{" "}
          <Link to="/register">Rejestracja</Link>
        </>
      ) : (
        <>
          <Link to="/schools">Szkoły</Link> |{" "}
          <LogoutButton onLogout={logout} />
        </>
      )}
    </nav>
  );
};

export default Navbar;
