import { NavLink, useNavigate } from "react-router-dom";
import { getCurrentUser, logout } from "../lib/api";
import {
  LayoutDashboard,
  Server,
  GitBranch,
  User,
  Users,
  LogOut,
  Monitor,
} from "lucide-react";

export default function Sidebar() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const isAdmin = user?.role === "Admin";

  function handleLogout() {
    logout();
    navigate("/");
  }

  const navItems = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
    { to: "/assets", label: "Assets", icon: Server, show: true },
    { to: "/allocations", label: "Allocations", icon: GitBranch, show: true },
    { to: "/users", label: "Users", icon: Users, show: isAdmin },
    { to: "/profile", label: "Profile", icon: User, show: true },
  ];

  return (
    <aside
      style={{
        width: "240px",
        backgroundColor: "#0f172a",
        color: "white",
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "20px 20px",
          borderBottom: "1px solid #1e293b",
        }}
      >
        <div
          style={{
            padding: "8px",
            backgroundColor: "#2563eb",
            borderRadius: "8px",
            flexShrink: 0,
          }}
        >
          <Monitor size={18} />
        </div>
        <div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: "0.875rem", lineHeight: 1.2 }}>
            IT Asset
          </p>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "#94a3b8" }}>Management</p>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 8px" }}>
        {navItems
          .filter((item) => item.show)
          .map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "9px 12px",
                borderRadius: "8px",
                fontSize: "0.875rem",
                fontWeight: 500,
                textDecoration: "none",
                marginBottom: "2px",
                backgroundColor: isActive ? "#2563eb" : "transparent",
                color: isActive ? "white" : "#94a3b8",
                transition: "background-color 0.15s, color 0.15s",
              })}
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
      </nav>

      {/* User + Logout */}
      <div
        style={{
          padding: "12px 8px",
          borderTop: "1px solid #1e293b",
        }}
      >
        <div style={{ padding: "8px 12px", marginBottom: "4px" }}>
          <p
            style={{
              margin: 0,
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "white",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {user?.fullName || "User"}
          </p>
          <p
            style={{
              margin: "2px 0 0",
              fontSize: "0.75rem",
              color: "#64748b",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {user?.role || ""}
          </p>
        </div>
        <button
          onClick={handleLogout}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "9px 12px",
            borderRadius: "8px",
            fontSize: "0.875rem",
            fontWeight: 500,
            color: "#94a3b8",
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <LogOut size={17} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
