import React, { useEffect, useState } from "react";
import api from "../../services/api";
import AlertCard from "./AlertCard";
import { Alert } from "../../types/alert";

const AlertList: React.FC<{ showOnly?: number }> = ({ showOnly }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    // Llama a tu endpoint real
    api.get<Alert[]>("/alerta/listar").then(res => setAlerts(res.data));
  }, []);

  const shown = showOnly ? alerts.slice(0, showOnly) : alerts;

  return (
    <>
      <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", color: "#374151"}}>
        <h3 style={{fontWeight: "bold", fontSize: "1.1rem"}}>Alertas Activas ({shown.length})</h3>
        {!showOnly && <button style={{
          background: "none",
          border: "none",
          color: "#ef4444",
          fontWeight: 500,
          cursor: "pointer"
        }}>Ver Todas</button>}
      </div>
      <div className="alerts-list">
        {shown.map((alert, i) => (
          <AlertCard key={alert.device_id + alert.timestamp + i} alert={alert} />
        ))}
      </div>
    </>
  );
};

export default AlertList;