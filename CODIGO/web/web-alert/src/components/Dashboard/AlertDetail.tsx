import React from "react";

interface Alert {
  estado: string;
  nombre: string;
  lat: number;
  lon: number;
  bateria: number;
  timestamp: string;
  device_id: string;
}

interface Props {
  alert: Alert | null;
  onClose?: () => void;
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

function batteryIcon(bateria: number) {
  if (bateria >= 75) return <span style={{color: "#22c55e"}}>🟩</span>;
  if (bateria >= 50) return <span style={{color: "#eab308"}}>🟨</span>;
  return <span style={{color: "#dc2626"}}>🟥</span>;
}

const AlertDetail: React.FC<Props> = ({ alert, onClose }) => {
  if (!alert) return null;

  return (
    <div className="bg-white p-5 rounded-xl shadow-xl flex flex-col space-y-4">
      <div className="flex justify-between items-center pb-3 border-b">
        <h3 className="text-xl font-bold text-gray-800">
          Detalles de Alerta <span className="text-gray-500 font-normal text-base">{alert.device_id}</span>
        </h3>
        {onClose && (
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-red-500">
            &#10005;
          </button>
        )}
      </div>
      <div className="overflow-y-auto space-y-6">
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-xs font-semibold uppercase text-gray-500 mb-1">Víctima</p>
          <p className="text-lg font-bold">{alert.nombre}</p>
          <p className="text-sm text-gray-600">Lat: {alert.lat}, Lon: {alert.lon}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Estado y Ubicación</p>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-700">Estado:</span>
              <span className="status-badge bg-red-100 text-red-700">{alert.estado}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Batería Dispositivo:</span>
              <span className="text-sm font-semibold text-green-600">{alert.bateria ?? "N/A"}%</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              <span>Lat: {alert.lat}, Lon: {alert.lon}</span>
            </p>
            <p className="text-xs text-gray-500">Hora de Activación: {formatTimeSince(alert.timestamp)}</p>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Unidad de Respuesta</p>
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="font-bold text-blue-800">Sin asignar</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertDetail;