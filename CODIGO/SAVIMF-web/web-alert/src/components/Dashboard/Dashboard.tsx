import React, { useState } from "react";
import Sidebar from "./Sidebar";
import SidebarPanel from "./SidebarPanel";
import MetricsCards from "./MetricsCards";
import AlertList from "./AlertList";
import MapView from "./MapView";
import DeviceManagement from "../Device/DeviceManagement";
import UserManagement from "../User/UserManagement";
import ReportsManagement from "../Reports/ReportsManagement";
import OpenDataModule from "../OpenData/OpenDataModule";
import HeatmapAnalysis from "../Analysis/HeatmapAnalysis";

const Dashboard: React.FC = () => {
  const [panel, setPanel] = useState<string>("dashboard");

  // Puedes cambiar el contenido mostrado al costado según el icono seleccionado
  const renderPanelContent = () => {
    switch (panel) {
      case "alerts":
        return (
          <>
            <h2 style={{fontSize: 22, fontWeight: 700, marginBottom: 16}}>Últimas Alertas</h2>
            <AlertList showOnly={3} />
          </>
        );
      case "devices":
        return <DeviceManagement />;
      case "users":
        return <UserManagement />;
      // 'reports' and 'opendata' are NOT rendered in the sidebar panel
      // to avoid duplicate UI (they are rendered full-screen in the main area).
      default:
        return null;
    }
  };

  return (
    <div style={{display: "flex", minHeight: "100vh", width: "100vw", position: "relative"}}>
      <Sidebar onSelect={setPanel} selected={panel} />
      {/* SidebarPanel: only for alerts/devices/users (NOT reports, opendata, or analysis) */}
      <SidebarPanel open={["alerts", "devices", "users"].includes(panel)} onClose={() => setPanel("dashboard")}>
        {renderPanelContent()}
      </SidebarPanel>
      <main style={{flex: 1, position: "relative", minHeight: "100vh"}}>
        {/* Si es reports u opendata, renderizar a pantalla completa SIN mapa */}
        {panel === "reports" ? (
          <div style={{width: "100%", height: "100vh", overflow: "auto"}}>
            <ReportsManagement />
          </div>
        ) : panel === "opendata" ? (
          <div style={{width: "100%", height: "100vh", overflow: "auto"}}>
            <OpenDataModule />
          </div>
        ) : (
          <>
            {/* Métricas flotantes sobre el mapa */}
            <div style={{
              position: "absolute", top: 32, right: 210, zIndex: 30, display: "flex", gap: 18,
              pointerEvents: "none"
            }}>
              <div style={{width: 140, pointerEvents: "auto"}}><MetricsCards small /></div>
            </div>
            {/* Mostrar el mapa principal o el mapa de calor a pantalla completa según la selección */}
            {panel === "analysis" ? (
              <HeatmapAnalysis />
            ) : (
              <MapView />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;