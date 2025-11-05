import React from "react";
import { BrowserRouter as Router } from "react-router-dom"
import AppRoutes from "./routes/AppRoutes";
import "./App.css"; // Import your global styles
import { ToastProvider } from "./components/Toast";
const App: React.FC = () => (
  <Router>
    <ToastProvider>
    <AppRoutes />
    </ToastProvider>
  </Router>
);

export default App;
