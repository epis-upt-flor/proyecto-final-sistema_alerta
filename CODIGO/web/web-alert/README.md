# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).



ESTA E MI ESRUCTURA DE WEB node_modules/
public/
src/
  components/
    Auth/
    Login.tsx
    PrivateRoute.tsx
    Dashboard/
      AlertDetail.tsx
      AlertList.tsx
      Dashboard.tsx
      MapView.tsx
      MetricsCards.tsx
      Sidebar.tsx
      SidebarPanel.tsx
    Device/
      DeviceManagement.tsx
    User/
  context/
  pages/
    Alerts.tsx
    Devices.tsx
    NotFound.tsx
    Users.tsx
  services/
    api.ts
    firebase.ts
  types/
  App.css
  App.test.tsx
  App.tsx
  index.css
  index.tsx
  logo.svg
  react-app-env.d.ts
  reportWebVitals.ts



  ESTAS ES MI ESTRUCTURA EN MI WEB CON REACT # Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).


node_modules/
public/
src/
  components/
    Auth/
    Login.tsx
    PrivateRoute.tsx
    Dashboard/
      AlertDetail.tsx
      AlertList.tsx
      Dashboard.tsx
      MapView.tsx
      MetricsCards.tsx
      Sidebar.tsx
      SidebarPanel.tsx
      AlertCard.tsx
    Device/
      DeviceManagement.tsx
    User/
    UserManagement.tsx
  context/
  pages/
    Alerts.tsx
    Devices.tsx
    NotFound.tsx
    Users.tsx
  services/
    api.ts
    firebase.ts
  types/
  App.css
  App.test.tsx
  App.tsx
  index.css
  index.tsx
  logo.svg
  react-app-env.d.ts
  reportWebVitals.ts  Y ESTE ES EL CONTENIDO DE CADA ARCHIVO: Login.tsx: import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../services/firebase";
import api from "../../services/api"; // Axios instance
import { useNavigate } from "react-router-dom";

type AuthResponse = {
  token: string;
  user: {
    uid: string;
    email: string;
    role: "admin" | "operator";
  };
};

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      if (user) {
        const token = await user.getIdToken();

        console.log("[FRONTEND] Enviando al backend:", { token });

        // 3. Envía el token al backend para validación
        const res = await api.post<AuthResponse>("/auth/firebase", { token });

        if (res.data && res.data.user && res.data.token) {
          const allowedRoles = ["admin", "operator"];
          if (allowedRoles.includes(res.data.user.role)) {
            localStorage.setItem("token", res.data.token);
            localStorage.setItem("user", JSON.stringify(res.data.user));
            navigate("/dashboard");
          } else {
            setError("No tienes permisos para acceder.");
            localStorage.removeItem("token");
            localStorage.removeItem("user");
          }
        } else {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setError("Error en la autenticación.");
        }
      }
    } catch (err: any) {
      setError("Usuario o contraseña incorrectos.");
      console.error("[FRONTEND] Error al loguear:", err);
      // Limpia el localStorage si hubo error
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    }
  };

  return (
    <form onSubmit={handleLogin} className="login-form">
      <h2>Iniciar Sesión</h2>
      <input
        type="email"
        placeholder="Correo"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Contraseña"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
      />
      <button type="submit">Entrar</button>
      {error && <p className="error">{error}</p>}
    </form>
  );
};

export default Login;           PrivateRoute.tsx: import React, { ReactElement } from "react";
import { Navigate } from "react-router-dom";

interface PrivateRouteProps {
  children: ReactElement;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  return user ? children : <Navigate to="/login" replace />;
};

export default PrivateRoute;             AlertDetail.tsx: import React from "react";
import { Alert } from "../../types/alert";

interface Props {
  alert: Alert | null;
  onClose?: () => void;
}

const AlertDetail: React.FC<Props> = ({ alert, onClose }) => {
  if (!alert) return null;

  return (
    <div className="bg-white p-5 rounded-xl shadow-xl flex flex-col space-y-4">
      <div className="flex justify-between items-center pb-3 border-b">
        <h3 className="text-xl font-bold text-gray-800">
          Detalles de Alerta <span className="text-gray-500 font-normal text-base">{alert.id}</span>
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
          <p className="text-lg font-bold">{alert.victimName}</p>
          <p className="text-sm text-gray-600">Dirección: {alert.location.address}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Estado y Ubicación</p>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-700">Estado:</span>
              <span className="status-badge bg-red-100 text-red-700">{alert.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Batería Dispositivo:</span>
              <span className="text-sm font-semibold text-green-600">{alert.battery ?? "N/A"}%</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              <span>{alert.location.address}</span>
            </p>
            <p className="text-xs text-gray-500">Hora de Activación: {alert.createdAt}</p>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Unidad de Respuesta</p>
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="font-bold text-blue-800">{alert.patrolName ?? "Sin asignar"}</p>
            {/* Otros detalles de patrulla si los tienes */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertDetail;                         AlertList.tsx: import React from "react";
import { BatteryFull, BatteryMedium } from "lucide-react";

const alerts = [
  {
    id: "A-9923",
    status: "nueva",
    victimName: "María C. Reyes",
    address: "Av. Pardo #150, Miraflores.",
    time: "Hace 15 segundos",
    battery: "full",
    statusText: "Despachada",
  },
  {
    id: "A-8105",
    status: "en_ruta",
    victimName: "Juana L. Mendoza",
    address: "Calle Los Robles 340, Surco.",
    time: "Hace 4 min",
    battery: "medium",
    statusText: "En Ruta",
  },
  {
    id: "A-7001",
    status: "resuelto",
    victimName: "Pedro R. Soto",
    address: "Jirón Huancayo 221, Lima.",
    time: "Hace 20 min",
    battery: "full",
    statusText: "Resuelto",
  },
];

const AlertList = ({ showOnly }: { showOnly?: number }) => {
  const shown = showOnly ? alerts.slice(0, showOnly) : alerts;
  return (
    <>
      <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", color: "#374151"}}>
        <h3 style={{fontWeight: "bold", fontSize: "1.1rem"}}>Alertas Activas ({shown.length})</h3>
        {!showOnly && <button style={{background: "none", border: "none", color: "#ef4444", fontWeight: 500, cursor: "pointer"}}>Ver Todas</button>}
      </div>
      {shown.map(alert => (
        <div
          key={alert.id}
          className={`alert-card${alert.status === "nueva" ? " new" : ""}`}
          style={alert.status === "resuelto" ? {opacity: 0.6} : {}}
        >
          <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
            <span className="status">{alert.statusText}</span>
            {alert.battery === "full"
              ? <BatteryFull style={{color: "#22c55e"}} />
              : <BatteryMedium style={{color: "#eab308"}} />}
          </div>
          <div className="alert-title">{alert.victimName}</div>
          <div className="alert-address">{alert.address}</div>
          <div className="alert-time">{alert.time}</div>
        </div>
      ))}
    </>
  );
};

export default AlertList;                          Dashboard.tsx: import React, { useState } from "react";
import Sidebar from "./Sidebar";
import SidebarPanel from "./SidebarPanel";
import MetricsCards from "./MetricsCards";
import AlertList from "./AlertList";
import MapView from "./MapView";
import DeviceManagement from "../Device/DeviceManagement";
import UserManagement from "../User/UserManagement";

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
      default:
        return null;
    }
  };

  return (
    <div style={{display: "flex", minHeight: "100vh", width: "100vw", position: "relative"}}>
      <Sidebar onSelect={setPanel} selected={panel} />
      <SidebarPanel open={["alerts", "devices", "users"].includes(panel)} onClose={() => setPanel("dashboard")}>
        {renderPanelContent()}
      </SidebarPanel>
      <main style={{flex: 1, position: "relative", minHeight: "100vh"}}>
        {/* Métricas flotantes sobre el mapa */}
        <div style={{
          position: "absolute", top: 32, right: 210, zIndex: 30, display: "flex", gap: 18,
          pointerEvents: "none"
        }}>
          <div style={{width: 140, pointerEvents: "auto"}}><MetricsCards small /></div>
        </div>
        {/* Mapa siempre visible */}
        <MapView />
      </main>
    </div>
  );
};

export default Dashboard;                         MapView.tsx: import React from "react";
import { Car, MapPin } from "lucide-react";

const MapView = () => (
  <div className="map-area" style={{height: "100vh"}}>
    {/* Patrulla */}
    <div style={{
      position: "absolute", top: "40%", left: "25%",
      transform: "translate(-50%, -50%)",
      background: "#2563eb", borderRadius: "9999px", padding: 10, border: "4px solid #fff", boxShadow: "0 0 8px #2563eb88"
    }}>
      <Car style={{color: "#fff"}} />
    </div>
    {/* Alerta */}
    <div style={{
      position: "absolute", top: "66%", right: "25%",
      transform: "translate(50%, -50%)",
      background: "#ef4444", borderRadius: "9999px", padding: 10, border: "4px solid #fff", boxShadow: "0 0 8px #ef444488"
    }}>
      <MapPin style={{color: "#fff"}} />
    </div>
    <span style={{position: "relative", zIndex: 2}}>MAPA INTERACTIVO (Google Maps API)</span>
  </div>
);

export default MapView;                           MetricsCards.tsx:import React from "react";
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

export default MetricsCards;                    Sidebar.tsx: import React from "react";
import { ShieldAlert, MapPinned, History, UserCog, Users, LogOut } from "lucide-react";

const sidebarItems = [
  {
    key: "dashboard",
    icon: <MapPinned size={26} />,
    label: "Centro de Comando",
    tooltip: "Centro de Comando",
  },
  {
    key: "alerts",
    icon: <History size={26} />,
    label: "Historial de Alertas",
    tooltip: "Historial de Alertas",
  },
  {
    key: "devices",
    icon: <UserCog size={26} />,
    label: "Víctimas y Dispositivos",
    tooltip: "Víctimas y Dispositivos",
    badge: "RF-022",
  },
  {
    key: "users",
    icon: <Users size={26} />,
    label: "Usuarios y Roles",
    tooltip: "Usuarios y Roles",
    badge: "RF-021",
  },
];

interface SidebarProps {
  onSelect: (panel: string) => void;
  selected: string;
}

const Sidebar: React.FC<SidebarProps> = ({ onSelect, selected }) => {
  return (
    <aside className="sidebar-mini">
      <div className="sidebar-mini__logo">
        <ShieldAlert style={{verticalAlign: "middle", marginRight: 0, color: "#ef4444"}} />
      </div>
      <nav className="sidebar-mini__nav">
        {sidebarItems.map(item => (
          <div
            key={item.key}
            className={`sidebar-mini__icon ${selected === item.key ? "active" : ""}`}
            title={item.tooltip}
            onClick={() => onSelect(item.key)}
          >
            {item.icon}
            {item.badge && <span className="mini-badge">{item.badge}</span>}
          </div>
        ))}
      </nav>
      <div className="sidebar-mini__profile">
        <div className="avatar-mini">OP</div>
        <button className="logout-mini"><LogOut size={18}/></button>
      </div>
    </aside>
  );
};

export default Sidebar;                              SidebarPanel.tsx: import React from "react";

interface SidebarPanelProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const SidebarPanel: React.FC<SidebarPanelProps> = ({ open, onClose, children }) => {
  return (
    <div className={`sidebar-panel-float${open ? " open" : ""}`}>
      {/* <button className="sidebar-panel-close" onClick={onClose} title="Cerrar panel">&times;</button> */}
      <div className="sidebar-panel-content">{children}</div>
    </div>
  );
};

export default SidebarPanel;                            DeviceManagement.tsx: import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { Device } from "../../types/device";
import { User } from "../../types/user";

type RegistrarResponse = { mensaje: string };

const hex16 = /^[A-Fa-f0-9]{16}$/;
const hex32 = /^[A-Fa-f0-9]{32}$/;

const DeviceManagement: React.FC = () => {
  // --- Registro ---
  const [form, setForm] = useState({
    DeviceId: "",
    DevEui: "",
    JoinEui: "",
    AppKey: "",
  });
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // --- Lista y vinculación ---
  const [devices, setDevices] = useState<Device[]>([]);
  const [dni, setDni] = useState("");
  const [victima, setVictima] = useState<User | null>(null);
  const [deviceToLink, setDeviceToLink] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  // 1. Cargar la lista de dispositivos
  const cargarDispositivos = async () => {
    try {
      const res = await api.get<Device[]>("/device/listar");
      if (Array.isArray(res.data)) {
        setDevices(res.data);
      } else {
        setDevices([]);
        setError("La respuesta del backend no es un array.");
      }
    } catch (err: any) {
      setDevices([]);
      setError("Error cargando dispositivos: " + (err?.response?.status || "") + " " + (err?.toString() || ""));
    }
  };

  useEffect(() => {
    cargarDispositivos();
  }, []);

  // --- Registrar Dispositivo ---
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validateForm = () => {
    if (!hex16.test(form.DevEui)) return "DevEUI debe tener 16 caracteres hexadecimales.";
    if (!hex16.test(form.JoinEui)) return "JoinEUI debe tener 16 caracteres hexadecimales.";
    if (!hex32.test(form.AppKey)) return "AppKey debe tener 32 caracteres hexadecimales.";
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");
    setRegSuccess("");

    const validationErr = validateForm();
    if (validationErr) {
      setRegError(validationErr);
      return;
    }

    setLoading(true);

    try {
      const res = await api.post<RegistrarResponse>("/device/registrar", form);
      setRegSuccess(res.data.mensaje || "Dispositivo registrado correctamente.");
      setForm({ DeviceId: "", DevEui: "", JoinEui: "", AppKey: "" });
      cargarDispositivos(); // Refresca la lista al registrar
    } catch (err: any) {
      setRegError(err?.response?.data?.mensaje || "Error desconocido al registrar.");
    } finally {
      setLoading(false);
    }
  };

  // --- Buscar víctima por DNI ---
  const buscarVictima = async () => {
    setVictima(null);
    setError("");
    setSuccess("");
    if (!dni) {
      setError("Ingresa un DNI.");
      return;
    }
    try {
      const res = await api.get<User>(`/user/buscar?dni=${dni}`);
      console.log("RESPUESTA DE BACKEND AL BUSCAR VÍCTIMA:", res.data); // <-- AGREGA ESTE LOG
      setVictima(res.data);
    } catch (err: any) {
      setVictima(null);
      setError("No se encontró la víctima o error en la búsqueda.");
    }
  };

  // --- Vincular dispositivo a víctima ---
  const vincular = async () => {
    setError("");
    setSuccess("");
    if (!victima || !deviceToLink) {
      setError("Selecciona víctima y dispositivo.");
      return;
    }
    try {
      await api.post("/user/vincular-dispositivo", {
        dni: victima.dni,
        deviceId: deviceToLink,
      });
      setSuccess("Dispositivo vinculado correctamente.");
      setDeviceToLink(null);
      cargarDispositivos(); // Refresca lista
      buscarVictima(); // Refresca datos víctima
    } catch (err: any) {
      setError("Error al vincular: " + (err?.response?.data?.mensaje || ""));
    }
  };

  return (
    <div className="device-management-area">
      {/* Panel izquierdo: Lista + Registro */}
      <div className="device-management-left">
        {/* --- LISTA DE DISPOSITIVOS --- */}
        <div className="device-list-card card">
          <h2 className="device-list-title">Lista de Dispositivos</h2>
          <table className="device-table">
            <thead>
              <tr>
                <th>DeviceId</th>
                <th>DevEui</th>
                <th>¿Vinculado?</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(devices) && devices.length > 0 ? (
                devices.map(device => (
                  <tr key={device.deviceId}>
                    <td>{device.deviceId}</td>
                    <td>{device.devEui}</td>
                    <td>{device.vinculado || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3}>No hay dispositivos registrados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* --- REGISTRAR DISPOSITIVO --- */}
        <div className="device-form-container card">
          <div className="device-form-title">Registrar Dispositivo en TTS</div>
          <form onSubmit={handleSubmit} className="device-form" autoComplete="off">
            <input className="device-input" name="DeviceId" placeholder="Device ID" value={form.DeviceId} onChange={handleChange} required />
            <input className="device-input" name="DevEui" placeholder="DevEUI (16 hex)" value={form.DevEui} onChange={handleChange} required maxLength={16} />
            <input className="device-input" name="JoinEui" placeholder="JoinEUI (16 hex)" value={form.JoinEui} onChange={handleChange} required maxLength={16} />
            <input className="device-input" name="AppKey" placeholder="AppKey (32 hex)" value={form.AppKey} onChange={handleChange} required maxLength={32} />
            <button className="device-btn" type="submit" disabled={loading}>
              {loading ? <span className="device-spinner"></span> : "Registrar"}
            </button>
          </form>
          {regError && <div className="device-error">{regError}</div>}
          {regSuccess && <div className="device-success">{regSuccess}</div>}
        </div>
      </div>
      {/* Panel derecho: Buscar y vincular víctima */}
      <div className="device-management-right card">
        <h2 className="device-vincular-title">Buscar y Vincular Víctima</h2>
        <div className="device-vincular-form">
          <input type="text" placeholder="DNI de la víctima" value={dni} onChange={e => setDni(e.target.value)} />
          <button onClick={buscarVictima} className="device-btn" style={{ marginLeft: 8 }}>Buscar</button>
        </div>
        {victima && (
          <div className="device-victima-card">
            <h3>Datos de la víctima</h3>
            <div>Nombre: {victima.nombre} {victima.apellido}</div>
            <div>DNI: {victima.dni}</div>
            <div>Email: {victima.email}</div>
            <div>Rol: {victima.role}</div>
            <div>Orden Juez: {victima.ordenJuez ? "Sí" : "No"}</div>
            <div>Device vinculado: {victima.deviceId || "-"}</div>
            {/* Vincular dispositivo SOLO si NO está vinculado */}
            {!victima.deviceId && (
              <div style={{ marginTop: 12 }}>
                <label>
                  Selecciona dispositivo para vincular:&nbsp;
                  <select
                    value={deviceToLink || ""}
                    onChange={e => setDeviceToLink(e.target.value)}
                    style={{ padding: "0.5rem", borderRadius: 6 }}
                  >
                    <option value="">-- Selecciona --</option>
                    {devices
                      .filter(device => device.vinculado === "NO")
                      .map(device => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.deviceId}
                        </option>
                      ))}
                  </select>
                </label>
                <button className="device-btn" style={{ marginLeft: 8 }} onClick={vincular}>Vincular</button>
              </div>
            )}
          </div>
        )}
        {error && <div className="device-error">{error}</div>}
        {success && <div className="device-success">{success}</div>}
      </div>
    </div>
  );
};

export default DeviceManagement;                        UserManagement.tsx: import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { User } from "../../types/user";

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    api.get<User[]>("/users").then(res => setUsers(res.data));
  }, []);

  return (
    <div>
      <h3>Gestión de Usuarios</h3>
      <ul>
        {users.map(user => (
          <li key={user.id}>
            {user.name} - {user.role}
          </li>
        ))}
      </ul>
      <button>Crear Usuario</button>
    </div>
  );
};

export default UserManagement;                           AuthContext.tsx: import React, { createContext, useState, ReactNode } from "react";
import api from "../services/api";

interface AuthContextType {
  user: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => false,
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<string | null>(null);

  const login = async (username: string, password: string) => {
    try {
      // TIPADO CORRECTO DE LA RESPUESTA
      const res = await api.post<{ user: string; token: string }>("/auth/login", { username, password });
      setUser(res.data.user);
      localStorage.setItem("token", res.data.token);
      return true;
    } catch {
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("token");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};                                     Alert.tsx:  import React from "react";
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

export default AlertsPage;                                      Device.tsx: import React from "react";
import DeviceManagement from "../components/Device/DeviceManagement";

const Devices: React.FC = () => (
  <div>
    <h2>Dispositivos y Víctimas</h2>
    <DeviceManagement />
  </div>
);

export default Devices;                       NotFound.tsx:  import React from "react";
import { Link } from "react-router-dom";

const NotFound: React.FC = () => (
  <div>
    <h2>Página no encontrada</h2>
    <Link to="/">Volver al Dashboard</Link>
  </div>
);

export default NotFound;                                   User.tsx: import React from "react";
import UserManagement from "../components/User/UserManagement";

const Users: React.FC = () => (
  <div>
    <h2>Usuarios</h2>
    <UserManagement />
  </div>
);

export default Users;                           api.tsx:  import axios from "axios";

const api = axios.create({
  baseURL: "https://ab4b6188cbc2.ngrok-free.app/api", // Cambia por tu URL real
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor para agregar el token si existe
api.interceptors.request.use(config => {
  const token = localStorage.getItem("token");
  if (token) {
    // Si headers no existe, lo creamos
    if (!config.headers) config.headers = {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;                                  alert.ts: export type AlertStatus = "nueva" | "en_ruta" | "resuelto";

export interface Alert {
  id: string;
  victimName: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  patrolName?: string;
  status: AlertStatus;
  battery?: number;
  createdAt: string;
}                                       device.ts: export interface Device {
  deviceId: string;
  devEui: string;
  joinEui: string;
  appKey: string;
  createdAt: string;
  updatedAt: string;
  vinculado?: string; // <-- agrega esto si no está
}                                            user.ts: export interface User {
  uid: string;
  dni: string;
  nombre: string;
  apellido: string;
  email: string;
  role: string;
  ordenJuez: boolean;
  deviceId ?: string; // el device vinculado, si hay
}                    y todo el diseño esta aca index.css: :root {
  --primary: #EF4444;
  --sidebar-bg: #1F2937;
  --sidebar-width: 280px;
  --card-radius: 16px;
}

body {
  font-family: 'Inter', sans-serif;
  background: #F3F4F6;
  margin: 0;
}

/* sidebar  */
.sidebar-mini {
  width: 72px;
  background: var(--sidebar-bg, #1F2937);
  color: #fff;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 rem 0;
  position: relative;
  box-shadow: 2px 0 8px #0001;
  z-index: 50;
}

.sidebar-mini__logo {
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.sidebar-mini__nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.3rem;
  width: 100%;
  align-items: center;
}

.sidebar-mini__icon {
  position: relative;
  width: 48px;
  height: 48px;
  margin: 0 auto;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
  background: none;
}

.sidebar-mini__icon:hover,
.sidebar-mini__icon.active {
  background: var(--primary, #EF4444);
}

.sidebar-mini__icon svg {
  color: #fff;
}

.mini-badge {
  position: absolute;
  top: 7px;
  right: 7px;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  border-radius: 8px;
  padding: 2px 6px;
  font-weight: 600;
}

.sidebar-mini__bottom {
  margin-top: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.avatar-mini {
  width: 38px;
  height: 38px;
  background: var(--primary, #EF4444);
  color: #fff;
  border-radius: 50%;
  text-align: center;
  line-height: 38px;
  font-weight: bold;
  margin-bottom: 2rem;
  font-size: 1.1rem;
}

.logout-mini {
  background: none;
  border: none;
  color: #fff;
  cursor: pointer;
  padding: 0;
  margin: 0;
  margin-bottom: 3rem;
}
/* sidebar fin */

/* sidebar panel */
.sidebar-panel-float {
  position: absolute;
  left: 72px;
  top: 32px;
  /* bottom: 0; */
  width: 380px;
  background: transparent; /* <--- sin fondo */
  box-shadow: none; /* <--- sin sombra */
  border-radius: 0;
  transition: transform 0.25s;
  transform: translateX(-120%);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  pointer-events: auto; /* para que solo los cards sean interactuables */
  z-index: 120;
}

.sidebar-panel-float.open {
  transform: translateX(0);
}
.sidebar-panel-close {
  border: none;
  background: none;
  font-size: 2rem;
  color: #888;
  align-self: flex-end;
  margin: 0.5rem 1rem 0 0;
  cursor: pointer;
}
.sidebar-panel-content {
  flex: 1;
  padding: 0 1.5rem 0 1.5rem;
  overflow-y: auto;
}
/* sidebar panel fin */

.profile {
  display: flex;
  align-items: center;
  margin-top: 2rem;
}

.profile .avatar {
  width: 40px;
  height: 40px;
  background: var(--primary);
  color: #fff;
  border-radius: 50%;
  text-align: center;
  line-height: 40px;
  font-weight: bold;
  margin-right: 0.75rem;
}

.dashboard-header {
  padding: 2rem 2rem 1rem 2rem;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2px 8px #0001;
}

.dashboard-title {
  font-size: 2rem;
  font-weight: bold;
  color: #1F2937;
}

.cards-row {
  display: flex;
  gap: 1.5rem;
  margin: 2rem 2rem 1rem 0.5rem; /* Solo 0.5rem a la izquierda */
}

.card {
  flex: 1;
  background: #fff;
  border-radius: var(--card-radius);
  box-shadow: 0 2px 8px #0001;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.card-title {
  font-size: 0.75rem;
  color: #6b7280;
  text-transform: uppercase;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.card-value {
  font-size: 2rem;
  font-weight: bold;
  color: #1F2937;
}

.alerts-area {
  padding: 2rem;
  flex: 1;
  display: flex;
  gap: 2rem;
}

.alerts-list {
  width: 350px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.alert-card {
  background: #fff;
  border-radius: var(--card-radius);
  box-shadow: 0 2px 8px #0001;
  padding: 1rem 1.25rem;
  border: 2px solid #fff;
  transition: border 0.2s, box-shadow 0.2s;
}

.alert-card.new {
  border-color: var(--primary);
  box-shadow: 0 0 8px 0 #ef4444aa;
}

.alert-card .status {
  display: inline-block;
  font-size: 0.7rem;
  background: #fee2e2;
  color: #ef4444;
  border-radius: 9999px;
  padding: 0.25rem 0.75rem;
  font-weight: bold;
}

.alert-card .alert-title {
  font-size: 1.1rem;
  font-weight: bold;
  margin-top: 0.5rem;
  color: #1F2937;
}

.alert-card .alert-address {
  color: #6b7280;
  font-size: 0.9rem;
}

.alert-card .alert-time {
  color: #9ca3af;
  font-size: 0.8rem;
  margin-top: 0.5rem;
}

.map-area {
  background: #e0f2f1;
  border-radius: var(--card-radius);
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: #1F2937;
  position: relative;
  min-height: 320px;
}

/* ==== FORMULARIO REGISTRO DISPOSITIVO ==== */
.device-form-container {
  background: #fff;
  padding: 1.7rem 2rem;
  border-radius: 18px;
  box-shadow: 0 4px 32px #0002;
  max-width: 440px;
  margin: auto;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}
.device-form-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1F2937;
  margin-bottom: 0.5rem;
  text-align: center;
}
.device-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.device-input {
  padding: 0.5rem;
  border: 1.5px solid #eee;
  border-radius: 8px;
  font-size: 1rem;
  transition: border .2s;
}
.device-input:focus {
  outline: none;
  border-color: var(--primary, #ef4444);
}
.device-btn {
  padding: 0.5rem 0;
  background: var(--primary, #ef4444);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1.1rem;
  cursor: pointer;
  transition: background 0.2s;
  margin-top: 0.5rem;
}
.device-btn:active {
  background: #b91c1c;
}
.device-success {
  color: #059669;
  background: #d1fae5;
  border-radius: 6px;
  padding: 0.7rem;
  margin-top: 0.5rem;
  text-align: center;
}
.device-error {
  color: #dc2626;
  background: #fee2e2;
  border-radius: 6px;
  padding: 0.7rem;
  margin-top: 0.5rem;
  text-align: center;
}
.device-spinner {
  border: 3px solid #f3f3f3;
  border-top: 3px solid var(--primary, #ef4444);
  border-radius: 50%;
  width: 22px;
  height: 22px;
  animation: device-spin 1s linear infinite;
  margin: 0 auto;
}
@keyframes device-spin {
  0% { transform: rotate(0deg);}
  100% { transform: rotate(360deg);}
}

/* Nuevo layout para gestión de dispositivos */
.device-management-area {
  display: grid;
  grid-template-columns: 1fr 420px;
  gap: 2.5rem;
  align-items: flex-start;
  padding: 0 2.5rem 2rem 1rem; /* Menos padding arriba */
  margin-top: 0; /* <-- Fuerza que esté arriba */
}

.device-management-left {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.device-list-card {
  background: #fff;
  border-radius: var(--card-radius, 16px);
  box-shadow: 0 2px 8px #0001;
  padding: 1.3rem;
  margin-bottom: 0;
}

.device-list-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1F2937;
  margin-bottom: 1rem;
}

.device-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0.5rem;
}

.device-table th, .device-table td {
  text-align: left;
  padding: 0.7rem 0.4rem;
  border-bottom: 1px solid #eee;
  font-size: 1rem;
}

.device-table th {
  color: #ef4444;
  font-weight: 700;
  background: #f9fafb;
}

.device-table tr:last-child td {
  border-bottom: none;
}

.device-management-right {
  background: #fff;
  border-radius: var(--card-radius, 16px);
  box-shadow: 0 2px 8px #0001;
  padding: 1.7rem 1.5rem;
  min-width: 340px;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.device-vincular-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1F2937;
  margin-bottom: 1rem;
}

.device-vincular-form {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  margin-bottom: 1.2rem;
}

.device-victima-card {
  background: #fee2e2;
  border: 1.5px solid #ef4444;
  border-radius: 8px;
  padding: 1.1rem 1.2rem;
  margin-top: 1rem;
}

.device-victima-card h3 {
  margin-top: 0;
  margin-bottom: 0.7rem;
  font-size: 1.08rem;
  font-weight: bold;
  color: #ef4444;
}

@media (max-width: 950px) {
  .device-management-area {
    grid-template-columns: 1fr;
  }
  .device-management-right {
    margin-top: 2rem;
    max-width: 100%;
  }
}
/* Nuevo layout para gestión de dispositivos */      LO QUE QUIERO HACER AHORA ES VINCULAR UN DISPOSSITIVO CON UNA VICTIMA COMO YA ESTA LO QUE ES REGISTRAR UN DISPOSITIVO AHI MISMO DEBERIA COMSTRAR LA LISTA CON LOS DISPOSITIVOS  REGISTRADOS QUE YA ESTAN VINCULADOS  7Y LOS QUE NO ESTAN VINCULADOS EN UNA SOLA LISTA Y TAMBIEN DEBE HABER UNA SECCION DONDE BUSCAR AL A LA VICTIMA POR DNI Y DEBE MOSTRAR TODOS LOS DATOS DE LA VICTIMA SI EL DNI ES CORRECTO ADEMAS TODO DEBE ESTAR EN LA PARTE DE REGISTRO DE DISPOSITIVO COMO SEGUIDO PERO QUE SE MUESTRE LSO PANELES EN EL RESTO DE ESPACIO COMO SI SE DEZPLEGARA CADA PANEL POR SEPARADO, QUE DEBO HACER