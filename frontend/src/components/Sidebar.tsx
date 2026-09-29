import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { getCurrentUser, logout } from "../lib/api";
import {
  LayoutDashboard,
  Server,
  GitBranch,
  User,
  Users,
  LogOut,
  Monitor,
  ScrollText,
  Wrench,
  QrCode,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import "./Sidebar.css";

export function Sidebar() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => {
    // Restore the preference on each page; smaller screens start with icons only.
    try {
      const saved = localStorage.getItem("sidebarCollapsed");
      if (saved !== null) return saved === "true";
    } catch {
      // The toggle still works when browser storage is unavailable.
    }
    return window.matchMedia("(max-width: 1023px)").matches;
  });
  const isAdmin = user?.role === "Admin";

  function toggleSidebar() {
    const nextCollapsed = !collapsed;
    setCollapsed(nextCollapsed);
    try {
      localStorage.setItem("sidebarCollapsed", String(nextCollapsed));
    } catch {
      // Saving the preference is optional.
    }
  }

  function handleLogout() {
    logout();
    navigate("/");
  }

  const navItems = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
    { to: "/assets", label: "Assets", icon: Server, show: true },
    { to: "/allocations", label: "Allocations", icon: GitBranch, show: true },
    { to: "/maintainence", label: "Maintenance", icon: Wrench, show: true },
    { to: "/licenses", label: "Licenses", icon: ScrollText, show: true },
    { to: "/qr-codes", label: "QR Codes", icon: QrCode, show: true },
    { to: "/employees", label: "Employees", icon: Users, show: isAdmin },
    { to: "/users", label: "Users", icon: Users, show: isAdmin },
  ];

  return (
    <aside
      id="app-sidebar"
      className="app-sidebar"
      data-collapsed={collapsed}
      aria-label="Main sidebar"
    >
      <div className="sidebar-brand" aria-label="IT Asset Management">
        <div className="sidebar-logo">
          <Monitor size={18} aria-hidden="true" />
        </div>
        {!collapsed && (
          <div className="sidebar-brand-text">
            <p>IT Asset</p>
            <p>Management</p>
          </div>
        )}
      </div>

      {/* Keep the toggle available in both sidebar sizes. */}
      <div className="sidebar-controls">
        <button
          type="button"
          className="sidebar-action sidebar-toggle"
          onClick={toggleSidebar}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          aria-controls="app-sidebar"
        >
          {collapsed ? (
            <PanelLeftOpen size={20} aria-hidden="true" />
          ) : (
            <PanelLeftClose size={20} aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Accessible names and hover labels identify links in the icon-only view. */}
      <nav className="sidebar-nav" aria-label="Main navigation">
        {navItems
          .filter((item) => item.show)
          .map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `sidebar-action sidebar-link${isActive ? " is-active" : ""}`
              }
              aria-label={label}
            >
              <Icon size={17} aria-hidden="true" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
      </nav>

      <div className="sidebar-footer">
        {/* Account actions stay separate from inventory and administration modules. */}
        <NavLink to="/profile" aria-label="Profile" className={({ isActive }) => `sidebar-action sidebar-link${isActive ? " is-active" : ""}`}>
          <User size={17} aria-hidden="true" />
          {!collapsed && <span>Profile</span>}
        </NavLink>
        <div
          className="sidebar-user"
          title={[user?.fullName || "User", user?.role].filter(Boolean).join(" - ")}
        >
          <User size={17} aria-hidden="true" />
          {!collapsed && (
            <div className="sidebar-user-text">
              <p>{user?.fullName || "User"}</p>
              <p>{user?.role || ""}</p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="sidebar-action sidebar-logout"
          aria-label="Sign Out"
        >
          <LogOut size={17} aria-hidden="true" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
