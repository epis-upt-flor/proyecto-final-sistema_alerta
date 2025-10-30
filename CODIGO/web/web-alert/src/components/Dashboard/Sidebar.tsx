import React from "react";
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

export default Sidebar;