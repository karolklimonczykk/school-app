import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import Footer from "../components/Footer";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [message, setMessage] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    try {
      const res = await axios.post("http://localhost:4000/auth/login", { email, password });
      const data = res.data as { token: string };
      login(data.token);
      if (remember) {
        localStorage.setItem("token", data.token);
      }
      setMessage("Zalogowano!");
      navigate("/schools");
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setMessage(err.response?.data?.error || "Błąd logowania");
      } else {
        setMessage("Błąd logowania");
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-gray-50">
      <div className="flex flex-1 flex-col md:flex-row">
        {/* LEFT PANEL */}
        <div className="w-full md:w-3/5 flex items-center justify-center px-4">
          <div className="max-w-md w-full space-y-6 py-12">
            <h2 className="text-3xl font-extrabold text-teal-500 mb-1">Witaj ponownie</h2>
            <p className="text-gray-500 mb-7 text-base font-medium">Wpisz adres e-mail i hasło, aby się zalogować</p>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1 text-gray-700">
                  E-mail
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-500"
                  placeholder="Twój adres e-mail"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1 text-gray-700">
                  Hasło
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-500"
                  placeholder="Twoje hasło"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
              {/* SUWAK REMEMBER ME */}
              <div className="flex items-center mb-2">
                <label htmlFor="remember" className="flex items-center cursor-pointer">
                  <div className="relative">
                    <input
                      id="remember"
                      type="checkbox"
                      checked={remember}
                      onChange={e => setRemember(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`block w-10 h-6 rounded-full transition-colors duration-200 ${remember ? "bg-teal-400" : "bg-gray-300"}`}></div>
                    <div
                      className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ${
                        remember ? "translate-x-4" : ""
                      }`}
                    ></div>
                  </div>
                  <span className="ml-3 text-sm text-gray-700 select-none">Zapamiętaj mnie</span>
                </label>
              </div>
              <button
                type="submit"
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-teal-400 hover:bg-teal-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-400 transition"
              >
                Zaloguj się
              </button>
              {message && (
                <div className="text-center text-red-500 font-medium">{message}</div>
              )}
            </form>
            <div className="text-center mt-4">
              <span className="text-gray-500">Nie masz jeszcze konta?</span>
              <Link to="/register" className="text-teal-500 font-bold ml-1 hover:underline">
                Zarejestruj się
              </Link>
            </div>
          </div>
        </div>
        {/* RIGHT PANEL */}
        <div className="hidden md:flex w-2/5 items-center justify-center relative bg-teal-300 rounded-bl-2xl">
          <span className="text-white text-4xl font-bold flex items-center gap-2 drop-shadow-md z-10">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="white" className="w-12 h-12">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
            </svg>
            school-app
          </span>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Login;
