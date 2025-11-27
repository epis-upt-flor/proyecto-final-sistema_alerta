import React, { useEffect, useState } from "react";
import api from "../../services/api";
import AlertCard from "./AlertCard";
import { Alert } from "../../types/alert";
import { getAddressFromCoords } from "../../services/geocoding";

const AlertList: React.FC<{ showOnly?: number }> = ({ showOnly }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    const loadAlertsWithGeocoding = async () => {
      try {
        const response = await api.get<Alert[]>("/alerta/activas"); // 🔥 USAR ENDPOINT ACTIVAS
        
        // Esperar a que Google Maps esté disponible
        const waitForGoogleMaps = () => {
          return new Promise<void>((resolve) => {
            const checkGoogle = () => {
              if (window.google && window.google.maps) {
                resolve();
              } else {
                setTimeout(checkGoogle, 100);
              }
            };
            checkGoogle();
          });
        };

        await waitForGoogleMaps();

        const alertsWithAddresses = await Promise.all(
          response.data
            .filter(alert => {
              // 🔥 FILTRO ADICIONAL: Excluir alertas vencidas, resueltas y archivadas
              const estado = alert.estado?.toLowerCase()?.trim();
              return !(estado === 'vencida' || estado === 'resuelto' || estado === 'resuelta' || estado === 'no-atendida');
            })
            .map(async (alert) => {
              // Si no tiene dirección pero tiene coordenadas, hacer geocoding
            if (!alert.direccion && alert.lat && alert.lon) {
              try {
                const address = await getAddressFromCoords(alert.lat, alert.lon);
                return { ...alert, direccion: address };
              } catch (error) {
                console.error('Error geocoding alert:', error);
                return alert;
              }
            }
            return alert;
          })
        );
        setAlerts(alertsWithAddresses);
      } catch (error) {
        console.error('Error loading alerts:', error);
        // Si falla, al menos mostrar las alertas sin geocoding
        try {
          const response = await api.get<Alert[]>("/alerta/activas"); // 🔥 USAR ENDPOINT ACTIVAS TAMBIÉN EN FALLBACK
          // 🔥 FILTRO DE SEGURIDAD EN FALLBACK TAMBIÉN
          const alertasFiltradas = response.data.filter(alert => {
            const estado = alert.estado?.toLowerCase()?.trim();
            return !(estado === 'vencida' || estado === 'resuelto' || estado === 'resuelta' || estado === 'no-atendida');
          });
          setAlerts(alertasFiltradas);
        } catch (fallbackError) {
          console.error('Error loading alerts fallback:', fallbackError);
        }
      }
    };

    loadAlertsWithGeocoding();
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