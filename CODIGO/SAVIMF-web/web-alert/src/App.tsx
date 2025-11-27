import React from "react";
import "./index.css"; 
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { LoadScript } from "@react-google-maps/api";
import Login from "./components/Auth/Login";
import Dashboard from "./components/Dashboard/Dashboard";
import UserManagement from "./components/User/UserManagement";
import DeviceManagement from "./components/Device/DeviceManagement";
import ReportsManagement from "./components/Reports/ReportsManagement";
import OpenDataModule from "./components/OpenData/OpenDataModule";
import Alerts from "./pages/Alerts";
import Users from "./pages/Users";
import Devices from "./pages/Devices";
import NotFound from "./pages/NotFound";
import { AuthProvider } from "./context/AuthContext";
import PrivateRoute from "./components/Auth/PrivateRoute";
import { GOOGLE_MAPS_API_KEY } from "./config/googleMaps";

// ✅ Definir libraries fuera del componente para evitar re-renders
const libraries: ("visualization" | "places" | "geometry")[] = ["visualization", "places"];

function App() {
  return (
    <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY} libraries={libraries}>
      <AuthProvider>
        <Router>
          <Routes>
          {/* Redirige la raíz al login si no está logueado */}
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<Login />} />
          {/* Rutas protegidas */}
          <Route path="/dashboard" element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          } />
          <Route path="/alerts" element={
            <PrivateRoute>
              <Alerts />
            </PrivateRoute>
          } />
          <Route path="/users" element={
            <PrivateRoute>
              <Users />
            </PrivateRoute>
          } />
          <Route path="/devices" element={
            <PrivateRoute>
              <Devices />
            </PrivateRoute>
          } />
          <Route path="/manage-users" element={
            <PrivateRoute>
              <UserManagement />
            </PrivateRoute>
          } />
          <Route path="/manage-devices" element={
            <PrivateRoute>
              <DeviceManagement />
            </PrivateRoute>
          } />
          <Route path="/reports" element={
            <PrivateRoute>
              <ReportsManagement />
            </PrivateRoute>
          } />
          <Route path="/opendata" element={
            <OpenDataModule />
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </AuthProvider>
    </LoadScript>
  );
}

export default App;