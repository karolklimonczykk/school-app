import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import Footer from "../components/Footer";

const Register: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [message, setMessage] = useState("");
   const [messageType, setMessageType] = useState<"error" | "success" | "">("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setMessageType("");
    if (password !== repeatPassword) {
      setMessage("Hasła nie są identyczne!");
      setMessageType("error");
      return;
    }
    setSubmitting(true);
    try {
      await axios.post("http://localhost:4000/auth/register", { email, password });
      setMessage("Rejestracja zakończona sukcesem! Zaraz zostaniesz przeniesiony do logowania.");
      setMessageType("success");
      setTimeout(() => navigate("/login"), 2500);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setMessage(err.response?.data?.error || "Błąd rejestracji");
      } else {
        setMessage("Błąd rejestracji");
      }
      setMessageType("error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-gray-50">
      <div className="flex flex-1 flex-col md:flex-row">
        {/* FORMULARZ */}
        <div className="w-full md:w-3/5 flex items-center justify-center px-4">
          <div className="max-w-md w-full space-y-6 py-12">
            <h2 className="text-3xl font-extrabold text-teal-500 mb-1">Create Account</h2>
            <p className="text-gray-500 mb-7 text-base font-medium">Enter your email and set a password to sign up</p>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1 text-gray-700">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-500"
                  placeholder="Your email address"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1 text-gray-700">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-500"
                  placeholder="Your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="repeatPassword" className="block text-sm font-medium mb-1 text-gray-700">
                  Repeat password
                </label>
                <input
                  id="repeatPassword"
                  name="repeatPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-500"
                  placeholder="Repeat your password"
                  value={repeatPassword}
                  onChange={e => setRepeatPassword(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-teal-400 hover:bg-teal-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-400 transition ${submitting ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                SIGN UP
              </button>
              {message && (
                 <div
                  className={`text-center font-medium ${
                    messageType === "success" ? "text-green-600" : "text-red-500"
                  }`}>
                  {message}
               </div>
              )}
            </form>
            <div className="text-center mt-4">
              <span className="text-gray-500">Already have an account?</span>
              <Link to="/login" className="text-teal-500 font-bold ml-1 hover:underline">
                Sign In
              </Link>
            </div>
          </div>
        </div>
        {/* RIGHT PANEL */}
        <div className="hidden md:flex w-2/5 items-center justify-center relative bg-teal-300 rounded-bl-2xl">
          <span className="text-white text-4xl font-bold flex items-center gap-2 drop-shadow-md z-10">
            {/* Ikona szkoły jak w loginie: */}
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

export default Register;
