import React from "react";
import { ShieldAlert, MapPinned, History, UserCog, Users, LogOut, BarChart3, FileText, Globe } from "lucide-react";

interface SidebarItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  tooltip: string;
  requiredRole?: "admin" | "operador"; // Si no se especifica, accesible para todos
}

const sidebarItems: SidebarItem[] = [
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
    key: "analysis",
    icon: <BarChart3 size={26} />,
    label: "Análisis y Tendencias",
    tooltip: "Análisis y Tendencias",
    requiredRole: "admin", // ❌ Solo admin
  },
  {
    key: "reports",
    icon: <FileText size={26} />,
    label: "Atestados Policiales",
    tooltip: "Atestados Policiales",
    requiredRole: "admin", // ❌ Solo admin
  },
  {
    key: "opendata",
    icon: <Globe size={26} />,
    label: "Open Data",
    tooltip: "Datos Abiertos Públicos",
  },
  {
    key: "devices",
    icon: <UserCog size={26} />,
    label: "Víctimas y Dispositivos",
    tooltip: "Víctimas y Dispositivos",
  },
  {
    key: "users",
    icon: <Users size={26} />,
    label: "Usuarios y Roles",
    tooltip: "Usuarios y Roles",
    requiredRole: "admin", // ❌ Solo admin
  },
];

interface SidebarProps {
  onSelect: (panel: string) => void;
  selected: string;
}

const Sidebar: React.FC<SidebarProps> = ({ onSelect, selected }) => {
  // Obtener rol del usuario desde localStorage
  const getUserRole = (): "admin" | "operador" | null => {
    try {
      const userStr = localStorage.getItem("user");
      if (!userStr) return null;
      const user = JSON.parse(userStr);
      return user.role || "operador";
    } catch {
      return null;
    }
  };

  const userRole = getUserRole();

  // Filtrar items según el rol del usuario
  const filteredItems = sidebarItems.filter(item => {
    if (!item.requiredRole) return true; // Accesible para todos
    if (userRole === "admin") return true; // Admin ve todo
    return false; // Operador no ve items que requieren admin
  });

  const handleLogout = () => {
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  return (
    <aside className="sidebar-mini">
      <div className="sidebar-mini__logo">
        <ShieldAlert style={{verticalAlign: "middle", marginRight: 0, color: "#ef4444", marginTop: "20px" }} />
      </div>
      <nav className="sidebar-mini__nav">
        {filteredItems.map(item => (
          <div
            key={item.key}
            className={`sidebar-mini__icon ${selected === item.key ? "active" : ""}`}
            title={item.tooltip}
            onClick={() => onSelect(item.key)}
          >
            {item.icon}
          </div>
        ))}
      </nav>
      <div className="sidebar-mini__profile">
        <div className="avatar-mini" title={userRole === "admin" ? "Administrador" : "Operador"}>
          {userRole === "admin" ? "AD" : "OP"}
        </div>
        <button className="logout-mini" onClick={handleLogout}><LogOut size={18}/></button>
      </div>
    </aside>
  );
};

export default Sidebar;