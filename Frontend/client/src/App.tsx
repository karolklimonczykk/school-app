import React from "react";
import { BrowserRouter as Router } from "react-router-dom";
// import Navbar from "./components/Navbar";
import AppRoutes from "./routes/AppRoutes";
import "./App.css"; // Import your global styles
const App: React.FC = () => (
  <Router>
    <AppRoutes />
  </Router>
);

export default App;
