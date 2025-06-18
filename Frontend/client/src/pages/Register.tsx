import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const Register: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");      // <- dodatkowe pole
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    if (password !== repeatPassword) {
      setMessage("Hasła nie są identyczne!");
      return;
    }
    try {
      await axios.post("http://localhost:4000/auth/register", { email, password });
      setMessage("Rejestracja zakończona sukcesem! Teraz możesz się zalogować.");
      setTimeout(() => navigate("/login"), 1000); // przekierowanie po sukcesie
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
          required
        />
        <input
          type="password"
          placeholder="Hasło"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Powtórz hasło"
          value={repeatPassword}
          onChange={e => setRepeatPassword(e.target.value)}
          required
        />
        <button type="submit">Zarejestruj</button>
      </form>
      {message && <div>{message}</div>}
    </div>
  );
};

export default Register;
