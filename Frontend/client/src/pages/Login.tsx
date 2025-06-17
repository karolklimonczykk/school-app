import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

type LoginProps = {
  onLogin: () => void;
};

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    try {
      const res = await axios.post("http://localhost:4000/auth/login", { email, password });
      const data = res.data as { token: string };
      setToken(data.token);
      localStorage.setItem("token", data.token);
      setMessage("Zalogowano!");
      onLogin();              // ← informuje App, że jesteśmy zalogowani
      navigate("/schools");   // ← przekierowuje na /schools
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setMessage(err.response?.data?.error || "Błąd logowania");
      } else {
        setMessage("Błąd logowania");
      }
    }
  };

  return (
    <div>
      <h2>Logowanie</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Hasło"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <button type="submit">Zaloguj</button>
      </form>
      {message && <div>{message}</div>}
    </div>
  );
};

export default Login;
