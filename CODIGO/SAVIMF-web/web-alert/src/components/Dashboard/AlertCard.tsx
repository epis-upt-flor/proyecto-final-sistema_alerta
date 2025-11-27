import React, { useState } from "react";

interface Props {
  alert: {
    estado: string;
    nombre: string;
    lat: number;
    lon: number;
    bateria: number;
    timestamp: string;
    device_id: string;
    direccion?: string;
  };
}

function formatTimeSince(timestamp: string) {
  const t = new Date(timestamp);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - t.getTime()) / 1000);
  if (seconds < 60) return `Hace ${seconds} segundos`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `Hace ${hours} horas`;
}

// Componente separado para la batería (para usar hooks)
const BatteryIcon: React.FC<{ bateria: number }> = ({ bateria }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const percentage = bateria || 0;
  let fillColor = "#dc2626"; // Rojo por defecto
  
  if (percentage >= 75) fillColor = "#22c55e"; // Verde
  else if (percentage >= 50) fillColor = "#eab308"; // Amarillo
  else if (percentage >= 25) fillColor = "#f97316"; // Naranja
  
  return (
    <div 
      style={{ 
        display: "inline-flex", 
        alignItems: "center", 
        gap: "4px", 
        position: "relative",
        cursor: "pointer"
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <svg width="28" height="16" viewBox="0 0 32 18" style={{ verticalAlign: "middle" }}>
        {/* Cuerpo de la batería */}
        <rect x="2" y="3" width="24" height="12" rx="2" fill="none" stroke="#666" strokeWidth="1.5"/>
        
        {/* Punta de la batería */}
        <rect x="26" y="6" width="3" height="6" rx="1" fill="#666"/>
        
        {/* Nivel de batería */}
        <rect 
          x="3.5" 
          y="4.5" 
          width={(21 * percentage) / 100} 
          height="9" 
          rx="1" 
          fill={fillColor}
        />
        
        {/* Texto del porcentaje dentro de la batería */}
        <text 
          x="14" 
          y="11.5" 
          fontSize="7" 
          textAnchor="middle" 
          fill={percentage > 40 ? "white" : "#333"}
          fontWeight="bold"
        >
          {percentage}%
        </text>
      </svg>
      
      {/* Tooltip personalizado */}
      {showTooltip && (
        <div
          style={{
            position: "absolute",
            top: "-40px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#333",
            color: "white",
            padding: "6px 12px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: "bold",
            whiteSpace: "nowrap",
            zIndex: 1000,
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
          }}
        >
          Batería: {percentage}%
          {/* Flecha del tooltip usando un div separado */}
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: "6px solid #333"
            }}
          />
        </div>
      )}
    </div>
  );
};

const AlertCard: React.FC<Props> = ({ alert }) => (
  <div className={`alert-card${alert.estado === "Despachada" ? " new" : ""}`}>
    <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
      <span className="status">{alert.estado}</span>
      <BatteryIcon bateria={alert.bateria} />
    </div>
    <div className="alert-title">{alert.nombre}</div>
    <div className="alert-address">
      {/* Si tienes dirección, muéstrala; si no, muestra lat/lon */}
      {alert.direccion
        ? alert.direccion
        : `Lat: ${alert.lat}, Lon: ${alert.lon}`
      }
    </div>
    <div className="alert-time">{formatTimeSince(alert.timestamp)}</div>
  </div>
);

export default AlertCard;