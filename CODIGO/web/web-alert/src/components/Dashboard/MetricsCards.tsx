import React from "react";
import { AlertTriangle, Car, UserCheck } from "lucide-react";

const MetricsCards: React.FC<{ small?: boolean }> = ({ small }) => (
  <div className="cards-row" style={small ? {gap: 8, margin: 0} : {}}>
    <div className="card" style={small ? {padding: "0.5rem", minWidth: 88} : {}}>
      <AlertTriangle style={{color: "#ef4444", marginBottom: 8, fontSize: small ? 18 : 24}} />
      <div className="card-title" style={small ? {fontSize: 11} : {}}>Alertas Activas</div>
      <div className="card-value" style={small ? {fontSize: 18} : {}}>3</div>
    </div>
    <div className="card" style={small ? {padding: "0.5rem", minWidth: 88} : {}}>
      <Car style={{color: "#2563eb", marginBottom: 8, fontSize: small ? 18 : 24}} />
      <div className="card-title" style={small ? {fontSize: 11} : {}}>Patrullas en Servicio</div>
      <div className="card-value" style={small ? {fontSize: 18} : {}}>12</div>
    </div>
    <div className="card" style={small ? {padding: "0.5rem", minWidth: 88} : {}}>
      <UserCheck style={{color: "#22c55e", marginBottom: 8, fontSize: small ? 18 : 24}} />
      <div className="card-title" style={small ? {fontSize: 11} : {}}>Promedio de Respuesta</div>
      <div className="card-value" style={small ? {fontSize: 18} : {}}>7 <span style={{fontSize: small ? 12 : 18, color: "#6b7280"}}>min</span></div>
    </div>
  </div>
);

export default MetricsCards;