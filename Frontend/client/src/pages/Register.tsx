import React, { useState } from "react";
import axios, { AxiosError } from "axios";

const Register: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    try {
      await axios.post("http://localhost:4000/auth/register", { email, password });
      setMessage("Rejestracja zakończona sukcesem! Teraz możesz się zalogować.");
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setMessage(err.response?.data?.error || "Błąd rejestracji");
      } else {
        setMessage("Błąd rejestracji");
      }
    }
  };

  return (
    <div>
      <h2>Rejestracja</h2>
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
        <button type="submit">Zarejestruj</button>
      </form>
      {message && <div>{message}</div>}
    </div>
  );
};

export default Register;
