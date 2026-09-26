import { useEffect, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import AuthGuard from "../components/AuthGuard";
import LoadError from "../components/LoadError";
import ManagementEditor from "../components/ManagementEditor";
import { employees, type Employee } from "../lib/api";
import { Users, Search, Building2, ShieldCheck, ShieldAlert, Pencil, Trash2 } from "lucide-react";

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  Active: { bg: "#dcfce7", color: "#15803d" },
  Inactive: { bg: "#f3f4f6", color: "#374151" },
};

export default function EmployeePage() {
  const [employeeList, setEmployeeList] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [editing, setEditing] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  function loadEmployees() {
    setLoading(true);
    setLoadError("");
    return employees
      .list()
      .then((data) => setEmployeeList(Array.isArray(data) ? data : []))
      .catch(() => setLoadError("Employees could not be loaded. Displayed records may be out of date."))
      .finally(() => setLoading(false));
  }
  useEffect(() => { void loadEmployees(); }, []);

  async function deleteEmployee(employee: Employee) {
    if (deleting || !confirm(`Delete ${employee.fullName}? Employees with allocation history cannot be deleted.`)) return;
    setDeleting(true);
    setActionError("");
    try { await employees.remove(employee._id); await loadEmployees(); }
    catch (err) { setActionError(err instanceof Error ? err.message : "Could not delete employee."); }
    finally { setDeleting(false); }
  }

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
        <main style={{ flex: 1, minWidth: 0, padding: "32px", overflowY: "auto" }}>
          <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
            {loadError && <LoadError message={loadError} retry={loadEmployees} />}
            {actionError && <p role="alert" className="mb-4 text-red-700">{actionError}</p>}
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
                    <p style={{ margin: "6px 0 0", fontSize: "1.5rem", fontWeight: 700 }}>{loadError ? "N/A" : loading ? "..." : tab.count}</p>
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
                overflowX: "auto",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    {["Employee ID", "Name", "Email", "Department & Designation", "Status", "Actions"].map((h) => (
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
                      <td colSpan={6} style={{ padding: "48px", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>
                        Loading employees…
                      </td>
                    </tr>
                  ) : loadError ? <tr><td colSpan={6} className="p-5">Employee data unavailable.</td></tr> : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: "48px", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>
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
                          <td className="px-4 py-3"><div className="flex gap-2">
                            <button title="Edit employee" aria-label={`Edit ${emp.fullName}`} onClick={() => setEditing(emp)} className="rounded border p-2"><Pencil size={16} /></button>
                            <button title="Delete employee" aria-label={`Delete ${emp.fullName}`} disabled={deleting} onClick={() => void deleteEmployee(emp)} className="rounded border p-2 text-red-700"><Trash2 size={16} /></button>
                          </div></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <p style={{ marginTop: "12px", fontSize: "0.8125rem", color: "#94a3b8" }}>
              {loadError ? "Employee count unavailable" : `Showing ${filtered.length} of ${employeeList.length} employees`}
            </p>
          </div>
          {editing && <ManagementEditor title="Edit employee" initial={{ fullName: editing.fullName, email: editing.email, employeeId: editing.employeeId, department: editing.department, designation: editing.designation, phone: editing.phone || "", status: editing.status }} fields={[
            { name: "fullName", label: "Full Name" }, { name: "email", label: "Email", type: "email" },
            { name: "employeeId", label: "Employee ID" }, { name: "department", label: "Department" },
            { name: "designation", label: "Designation" }, { name: "phone", label: "Phone", optional: true },
            { name: "status", label: "Status", options: ["Active", "Inactive"] },
          ]} onClose={() => setEditing(null)} onSave={async values => {
            await employees.update(editing._id, { ...values, status: values.status as Employee["status"] });
            await loadEmployees();
          }} />}
        </main>
      </div>
    </AuthGuard>
  );
}
