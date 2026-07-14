import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import AuthGuard from "../components/AuthGuard";
import { employees, type Employee } from "../lib/api";
import { Users, Search, Building2, ShieldCheck, ShieldAlert } from "lucide-react";

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  Active: { bg: "#dcfce7", color: "#15803d" },
  Inactive: { bg: "#f3f4f6", color: "#374151" },
};

export default function EmployeePage() {
  const [employeeList, setEmployeeList] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  useEffect(() => {
    employees
      .list()
      .then((data) => setEmployeeList(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = employeeList.filter((emp) => {
    const matchSearch =
      emp.fullName.toLowerCase().includes(search.toLowerCase()) ||
      emp.email.toLowerCase().includes(search.toLowerCase()) ||
      emp.employeeId.toLowerCase().includes(search.toLowerCase());
    
    const matchStatus = statusFilter === "All" || emp.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = {
    All: employeeList.length,
    Active: employeeList.filter((e) => e.status === "Active").length,
    Inactive: employeeList.filter((e) => e.status === "Inactive").length,
  };

  return (
    <AuthGuard>
      <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f8fafc" }}>
        <Sidebar />
        <main style={{ flex: 1, padding: "32px", overflowY: "auto" }}>
          <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
            {/* Header */}
            <div style={{ marginBottom: "28px" }}>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                Personnel Directory
              </h1>
              <p style={{ color: "#64748b", marginTop: "4px", fontSize: "0.875rem" }}>
                View and manage company employees eligible for asset allocations
              </p>
            </div>

            {/* Stats Row */}
            <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
              {[
                { name: "All", count: counts.All, color: "#475569", icon: Users, bg: "#f1f5f9" },
                { name: "Active", count: counts.Active, color: "#15803d", icon: ShieldCheck, bg: "#dcfce7" },
                { name: "Inactive", count: counts.Inactive, color: "#4b5563", icon: ShieldAlert, bg: "#f3f4f6" },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = statusFilter === tab.name;
                return (
                  <button
                    key={tab.name}
                    onClick={() => setStatusFilter(tab.name)}
                    style={{
                      flex: 1,
                      padding: "16px 20px",
                      backgroundColor: isActive ? tab.color : "white",
                      color: isActive ? "white" : "#0f172a",
                      border: `1px solid ${isActive ? tab.color : "#e2e8f0"}`,
                      borderRadius: "10px",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{tab.name} Employees</span>
                      <Icon size={15} />
                    </div>
                    <p style={{ margin: "6px 0 0", fontSize: "1.5rem", fontWeight: 700 }}>{tab.count}</p>
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div style={{ marginBottom: "20px", position: "relative" }}>
              <Search
                size={16}
                style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, or employee ID…"
                style={{
                  width: "100%",
                  padding: "10px 14px 10px 40px",
                  fontSize: "0.875rem",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  outline: "none",
                  boxSizing: "border-box",
                  backgroundColor: "white",
                }}
              />
            </div>

            {/* Table */}
            <div
              style={{
                backgroundColor: "white",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                overflow: "hidden",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    {["Employee ID", "Name", "Email", "Department & Designation", "Status"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "12px 20px",
                          textAlign: "left",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          color: "#64748b",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} style={{ padding: "48px", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>
                        Loading employees…
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: "48px", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>
                        No employees found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((emp, i) => {
                      const statusStyle = STATUS_STYLES[emp.status] || { bg: "#f1f5f9", color: "#475569" };
                      return (
                        <tr
                          key={emp._id}
                          style={{
                            borderBottom: i < filtered.length - 1 ? "1px solid #f1f5f9" : "none",
                            transition: "background-color 0.1s",
                          }}
                        >
                          <td style={{ padding: "14px 20px", fontSize: "0.875rem", fontWeight: 600, color: "#64748b" }}>
                            {emp.employeeId}
                          </td>
                          <td style={{ padding: "14px 20px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                              <div
                                style={{
                                  width: "36px",
                                  height: "36px",
                                  borderRadius: "50%",
                                  backgroundColor: "#2563eb",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "white",
                                  fontWeight: 700,
                                  fontSize: "0.875rem",
                                  flexShrink: 0,
                                }}
                              >
                                {emp.fullName?.charAt(0).toUpperCase() || "?"}
                              </div>
                              <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0f172a" }}>
                                {emp.fullName}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: "14px 20px", fontSize: "0.875rem", color: "#64748b" }}>
                            {emp.email}
                          </td>
                          <td style={{ padding: "14px 20px" }}>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "#0f172a" }}>
                                {emp.designation}
                              </span>
                              <span style={{ fontSize: "0.75rem", color: "#64748b", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                                <Building2 size={12} /> {emp.department}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: "14px 20px" }}>
                            <span
                              style={{
                                padding: "3px 10px",
                                borderRadius: "999px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                backgroundColor: statusStyle.bg,
                                color: statusStyle.color,
                              }}
                            >
                              {emp.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <p style={{ marginTop: "12px", fontSize: "0.8125rem", color: "#94a3b8" }}>
              Showing {filtered.length} of {employeeList.length} employees
            </p>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}