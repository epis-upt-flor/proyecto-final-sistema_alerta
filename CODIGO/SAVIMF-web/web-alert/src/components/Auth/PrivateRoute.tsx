import React, { ReactElement } from "react";
import { Navigate } from "react-router-dom";

interface PrivateRouteProps {
  children: ReactElement;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  return user ? children : <Navigate to="/login" replace />;
};

export default PrivateRoute;