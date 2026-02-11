import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import LoginPage from "./LoginPage";
import SignupPage from "./SignupPage";

import KttmDashboardPage from "./kttmHome";      // your dashboard page (kttmHome.jsx)
import IpAssetsPage from "./IpAssets";      // ✅ NEW full list CRUD page (create this file)

import Patient from "./Patient";
import ServicesPage from "./ServicesPage";
import ContactPage from "./ContactPage";
import PatientProfile from "./PatientProfile";

function App() {
  return (
    <Router>
      <Routes>
        {/* Landing / login */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* KTTM */}
        <Route path="/kttmHome" element={<KttmDashboardPage />} />
        <Route path="/IpAssets" element={<IpAssetsPage />} />

        {/* Existing pages */}
        <Route path="/patient-dashboard" element={<Patient />} />
    
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/patient-profile" element={<PatientProfile />} />

        {/* Optional: fallback */}
        <Route path="*" element={<LoginPage />} />
      </Routes>
    </Router>
  );
}

export default App;
