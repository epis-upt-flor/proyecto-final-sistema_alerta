import React from "react";
import AlertList from "../components/Dashboard/AlertList";

const AlertsPage: React.FC = () => {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Historial de Alertas</h2>
      <AlertList />
      {/* Aquí puedes agregar filtros y exportar */}
    </div>
  );
};

export default AlertsPage;