import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
// FIX: Imported both auth and employees services
import { auth, employees, getCurrentUser, type Employee } from "../lib/api"; 
import { UserPlus, UserCheck, UserX, LogOut, Pencil } from "lucide-react";
import LoadError from "../components/LoadError";
import ManagementEditor from "../components/ManagementEditor";

const USER_ROLES = ["IT Staff", "Admin"] as const;

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 14px",
  fontSize: "0.875rem",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  outline: "none",
  boxSizing: "border-box",
  backgroundColor: "white",
  color: "#111827",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.8125rem",
  fontWeight: 600,
  color: "#374151",
  marginBottom: "5px",
};

interface SimpleUser {
  id: string;
  name: string;
  email?: string;
  role?: string;
  isActive?: boolean;
}

export default function CreateUserPage() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  // Tab state: "user" (System User) or "employee" (Company Employee)
  const [activeTab, setActiveTab] = useState<"user" | "employee">("user");

  // Form State for System User
  const [userForm, setUserForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "IT Staff" as (typeof USER_ROLES)[number],
  });

  // Form State for Company Employee
  const [employeeForm, setEmployeeForm] = useState({
    fullName: "",
    email: "",
    employeeId: "",
    department: "",
    designation: "",
    phone: "",
    status: "Active" as "Active" | "Inactive",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Lists
  const [userList, setUserList] = useState<SimpleUser[]>([]);
  const [employeeList, setEmployeeList] = useState<Employee[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [accessBusy, setAccessBusy] = useState(false);
  const [editing, setEditing] = useState<SimpleUser | null>(null);
  const [listError, setListError] = useState("");

  useEffect(() => {
    if (!currentUser || currentUser.role !== "Admin") {
      navigate("/dashboard");
      return;
    }
    loadData();
  }, [activeTab]);

  async function loadData() {
    setListLoading(true);
    setListError("");
    try {
      if (activeTab === "user") {
        const data = await auth.getAllUsers();
        setUserList(data);
      } else {
        const data = await employees.list();
        setEmployeeList(data);
      }
    } catch (err) {
      setListError("Directory could not be loaded. Displayed records may be out of date.");
    } finally {
      setListLoading(false);
    }
  }

  async function changeAccess(user: SimpleUser, revokeOnly = false) {
    const action = revokeOnly ? "Revoke sessions for" : user.isActive === false ? "Enable" : "Disable";
    if (!confirm(`${action} ${user.name}?`)) return;
    setAccessBusy(true);
    setError("");
    setSuccess("");
    try {
      await auth.updateAccess(user.id, revokeOnly ? { revokeSessions: true } : { isActive: user.isActive === false });
      await loadData();
      setSuccess(`Account access updated for ${user.name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update access.");
    } finally {
      setAccessBusy(false);
    }
  }

  // Handle Form Input changes
  function handleUserChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setUserForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  function handleEmployeeChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setEmployeeForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  // Submit Handler
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (activeTab === "user") {
        // Create Dashboard User account
        await auth.register(userForm.fullName, userForm.email, userForm.password, userForm.role);
        setSuccess(`System User "${userForm.fullName}" created successfully.`);
        setUserForm({ fullName: "", email: "", password: "", role: "IT Staff" });
      } else {
        // Create Company Employee entry
        await employees.create({
          fullName: employeeForm.fullName,
          email: employeeForm.email,
          employeeId: employeeForm.employeeId,
          department: employeeForm.department,
          designation: employeeForm.designation,
          phone: employeeForm.phone || undefined,
          status: employeeForm.status,
        });
        setSuccess(`Employee "${employeeForm.fullName}" registered successfully.`);
        setEmployeeForm({ fullName: "", email: "", employeeId: "", department: "", designation: "", phone: "", status: "Active" });
      }
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save record.");
    } finally {
      setLoading(false);
    }
  }

  const roleBadge = (role: string) => {
    const colors: Record<string, { bg: string; color: string }> = {
      Admin: { bg: "#ede9fe", color: "#7c3aed" },
      "IT Staff": { bg: "#dbeafe", color: "#1d4ed8" },
      Employee: { bg: "#dcfce7", color: "#15803d" },
    };
    const c = colors[role] || { bg: "#f3f4f6", color: "#374151" };
    return (
      <span
        style={{
          padding: "2px 10px",
          borderRadius: "999px",
          fontSize: "0.75rem",
          fontWeight: 600,
          backgroundColor: c.bg,
          color: c.color,
        }}
      >
        {role}
      </span>
    );
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f8fafc" }}>
      <Sidebar />
      <main style={{ flex: 1, padding: "32px", overflowY: "auto" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          {listError && <LoadError message={listError} retry={loadData} />}
          
          {/* Header */}
          <div style={{ marginBottom: "24px" }}>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
              Account & Personnel Provisioning
            </h1>
            <p style={{ color: "#64748b", marginTop: "4px", fontSize: "0.875rem" }}>
              Provision dashboard system accounts or create company employee profiles
            </p>
          </div>

          {/* Toggle Tabs */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "28px", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px" }}>
            <button
              onClick={() => setActiveTab("user")}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: activeTab === "user" ? "#2563eb" : "transparent",
                color: activeTab === "user" ? "white" : "#64748b",
                fontWeight: 600,
                fontSize: "0.875rem",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              System User (IT / Admin)
            </button>
            <button
              onClick={() => setActiveTab("employee")}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: activeTab === "employee" ? "#2563eb" : "transparent",
                color: activeTab === "employee" ? "white" : "#64748b",
                fontWeight: 600,
                fontSize: "0.875rem",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              Company Employee
            </button>
          </div>

          <div className="provisioning-grid" style={{ display: "grid", minWidth: 0, gap: "28px", alignItems: "start" }}>
            
            {/* Left Column: Context-Aware Creation Form */}
            <div style={{ backgroundColor: "white", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ padding: "8px", backgroundColor: "#eff6ff", borderRadius: "8px" }}>
                  <UserPlus size={18} color="#2563eb" />
                </div>
                <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "#0f172a" }}>
                  {activeTab === "user" ? "Create Dashboard User" : "Register Employee Profile"}
                </h2>
              </div>

              <form onSubmit={handleSubmit} style={{ padding: "24px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  
                  {activeTab === "user" ? (
                    // --- USER FORM FIELDS ---
                    <>
                      <div>
                        <label htmlFor="CreateUserPage-field-1" style={labelStyle}>Full Name</label>
                        <input id="CreateUserPage-field-1" name="fullName" value={userForm.fullName} onChange={handleUserChange} placeholder="John Doe" required style={fieldStyle} />
                      </div>

                      <div>
                        <label htmlFor="CreateUserPage-field-2" style={labelStyle}>Email Address</label>
                        <input id="CreateUserPage-field-2" name="email" type="email" value={userForm.email} onChange={handleUserChange} placeholder="john@company.com" required style={fieldStyle} />
                      </div>

                      <div>
                        <label htmlFor="CreateUserPage-field-3" style={labelStyle}>Password</label>
                        <input id="CreateUserPage-field-3" name="password" type="password" value={userForm.password} onChange={handleUserChange} placeholder="Min. 6 characters" required minLength={6} style={fieldStyle} />
                      </div>

                      <div>
                        <label htmlFor="CreateUserPage-field-4" style={labelStyle}>System Role</label>
                        <select id="CreateUserPage-field-4" name="role" value={userForm.role} onChange={handleUserChange} style={fieldStyle}>
                          {USER_ROLES.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  ) : (
                    // --- EMPLOYEE FORM FIELDS ---
                    <>
                      <div className="responsive-grid" style={{ display: "grid", minWidth: 0, gap: "12px" }}>
                        <div>
                          <label htmlFor="CreateUserPage-field-5" style={labelStyle}>Full Name</label>
                          <input id="CreateUserPage-field-5" name="fullName" value={employeeForm.fullName} onChange={handleEmployeeChange} placeholder="Jane Doe" required style={fieldStyle} />
                        </div>
                        <div>
                          <label htmlFor="CreateUserPage-field-6" style={labelStyle}>Employee ID</label>
                          <input id="CreateUserPage-field-6" name="employeeId" value={employeeForm.employeeId} onChange={handleEmployeeChange} placeholder="EMP-1024" required style={fieldStyle} />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="CreateUserPage-field-7" style={labelStyle}>Email Address</label>
                        <input id="CreateUserPage-field-7" name="email" type="email" value={employeeForm.email} onChange={handleEmployeeChange} placeholder="jane@company.com" required style={fieldStyle} />
                      </div>

                      <div className="responsive-grid" style={{ display: "grid", minWidth: 0, gap: "12px" }}>
                        <div>
                          <label htmlFor="CreateUserPage-field-8" style={labelStyle}>Department</label>
                          <input id="CreateUserPage-field-8" name="department" value={employeeForm.department} onChange={handleEmployeeChange} placeholder="Engineering" required style={fieldStyle} />
                        </div>
                        <div>
                          <label htmlFor="CreateUserPage-field-9" style={labelStyle}>Designation</label>
                          <input id="CreateUserPage-field-9" name="designation" value={employeeForm.designation} onChange={handleEmployeeChange} placeholder="Software Engineer" required style={fieldStyle} />
                        </div>
                      </div>

                      <div className="responsive-grid" style={{ display: "grid", minWidth: 0, gap: "12px" }}>
                        <div>
                          <label htmlFor="CreateUserPage-field-10" style={labelStyle}>Phone Number (Optional)</label>
                          <input id="CreateUserPage-field-10" name="phone" value={employeeForm.phone} onChange={handleEmployeeChange} placeholder="+12345678" style={fieldStyle} />
                        </div>
                        <div>
                          <label htmlFor="CreateUserPage-field-11" style={labelStyle}>Status</label>
                          <select id="CreateUserPage-field-11" name="status" value={employeeForm.status} onChange={handleEmployeeChange} style={fieldStyle}>
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                  {error && <div style={{ padding: "10px 14px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", color: "#b91c1c", fontSize: "0.8125rem" }}>{error}</div>}
                  {success && <div style={{ padding: "10px 14px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", color: "#15803d", fontSize: "0.8125rem" }}>{success}</div>}

                  <button type="submit" disabled={loading} style={{ width: "100%", padding: "11px", backgroundColor: loading ? "#93c5fd" : "#2563eb", color: "white", border: "none", borderRadius: "8px", fontSize: "0.875rem", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", marginTop: "4px" }}>
                    {loading ? "Saving…" : activeTab === "user" ? "Create User" : "Register Employee"}
                  </button>
                </div>
              </form>
            </div>

            {/* Right Column: Context-Aware Directories */}
            <div style={{ backgroundColor: "white", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0" }}>
                <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "#0f172a" }}>
                  {activeTab === "user" ? "Registered System Users" : "Registered Employees"}
                  <span style={{ marginLeft: "8px", padding: "2px 8px", backgroundColor: "#f1f5f9", borderRadius: "999px", fontSize: "0.75rem", color: "#64748b", fontWeight: 500 }}>
                    {activeTab === "user" ? userList.length : employeeList.length}
                  </span>
                </h2>
              </div>

              <div style={{ maxHeight: "480px", overflowY: "auto" }}>
                {listLoading ? (
                  <div style={{ padding: "40px", textAlign: "center", color: "#64748b", fontSize: "0.875rem" }}>Loading directory…</div>
                ) : listError ? <p className="p-5">Directory data unavailable.</p> : activeTab === "user" ? (
                  // SYSTEM USERS LIST RENDERER
                  userList.length === 0 ? (
                    <div style={{ padding: "40px", textAlign: "center", color: "#64748b", fontSize: "0.875rem" }}>No users found.</div>
                  ) : (
                    userList.map((u, i) => (
                      <div className="page-toolbar" key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", borderBottom: i < userList.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: "0.875rem", flexShrink: 0 }}>
                            {u.name?.charAt(0).toUpperCase() || "?"}
                          </div>
                          <div>
                            <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, color: "#0f172a" }}>{u.name}</p>
                            <p style={{ margin: "1px 0 0", fontSize: "0.75rem", color: "#64748b" }}>{u.email || "No Email"}</p>
                          </div>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center", gap: "8px" }}>
                          {roleBadge(u.role || "IT Staff")}
                          <span style={{ fontSize: "12px" }}>{u.isActive === false ? "Disabled" : "Active"}</span>
                          {/* Access changes retain the account and its allocation history. */}
                          {u.id !== currentUser?._id && <>
                            <button title="Edit account" aria-label={`Edit ${u.name}`} onClick={() => setEditing(u)} className="rounded border border-gray-300 p-2"><Pencil size={16} /></button>
                            <button type="button" disabled={accessBusy}
                              title={u.isActive === false ? "Enable account" : "Disable account"}
                              aria-label={`${u.isActive === false ? "Enable" : "Disable"} ${u.name}`}
                              onClick={() => changeAccess(u)} className="rounded border border-gray-300 p-2 disabled:opacity-50">
                              {u.isActive === false ? <UserCheck size={16} /> : <UserX size={16} />}
                            </button>
                            <button type="button" disabled={accessBusy || u.isActive === false}
                              title="Revoke sessions" aria-label={`Revoke sessions for ${u.name}`}
                              onClick={() => changeAccess(u, true)} className="rounded border border-gray-300 p-2 disabled:opacity-50">
                              <LogOut size={16} />
                            </button>
                          </>}
                        </div>
                      </div>
                    ))
                  )
                ) : (
                  // EMPLOYEES LIST RENDERER
                  employeeList.length === 0 ? (
                    <div style={{ padding: "40px", textAlign: "center", color: "#64748b", fontSize: "0.875rem" }}>No employees found.</div>
                  ) : (
                    employeeList.map((emp, i) => (
                      <div className="page-toolbar" key={emp._id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", borderBottom: i < employeeList.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: "0.875rem", flexShrink: 0 }}>
                            {emp.fullName?.charAt(0).toUpperCase() || "?"}
                          </div>
                          <div>
                            <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, color: "#0f172a" }}>{emp.fullName}</p>
                            <p style={{ margin: "1px 0 0", fontSize: "0.75rem", color: "#64748b" }}>{emp.employeeId} • {emp.designation}</p>
                          </div>
                        </div>
                        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: emp.status === "Active" ? "#15803d" : "#4b5563" }}>
                          {emp.status}
                        </span>
                      </div>
                    ))
                  )
                )}
              </div>
            </div>

          </div>
        </div>
        {editing && <ManagementEditor title="Edit account" initial={{ fullName: editing.name, email: editing.email || "", role: editing.role || "IT Staff" }} fields={[
          { name: "fullName", label: "Full Name" }, { name: "email", label: "Email", type: "email" },
          { name: "role", label: "Role", options: [...USER_ROLES] },
        ]} onClose={() => setEditing(null)} onSave={async values => {
          await auth.updateUser(editing.id, { fullName: values.fullName, email: values.email, role: values.role });
          await loadData();
          setSuccess("Account updated. Existing sessions have been revoked.");
        }} />}
      </main>
    </div>
  );
}
