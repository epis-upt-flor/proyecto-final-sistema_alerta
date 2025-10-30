import React from "react";
import { Link } from "react-router-dom";

const NotFound: React.FC = () => (
  <div>
    <h2>Página no encontrada</h2>
    <Link to="/">Volver al Dashboard</Link>
  </div>
);

export default NotFound;