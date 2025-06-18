import React from "react";
import { BrowserRouter as Router } from "react-router-dom";
import Navbar from "./components/Navbar";
import AppRoutes from "./routes/AppRoutes";

const App: React.FC = () => (
  <Router>
    <Navbar />
    <AppRoutes />
  </Router>
);

export default App;
