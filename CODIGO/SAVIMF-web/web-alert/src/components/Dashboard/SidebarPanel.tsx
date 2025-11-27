import React from "react";

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

export default SidebarPanel;