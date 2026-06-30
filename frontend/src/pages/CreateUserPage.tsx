import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
// FIX: Imported auth instead of the non-existent users object
import { auth, getCurrentUser } from "../lib/api"; 
import { UserPlus } from "lucide-react";

const ROLES = ["IT Staff", "Employee", "Admin"] as const;

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

export default function CreateUserPage() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "IT Staff" as (typeof ROLES)[number],
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  
  // FIX: Updated state type to match what auth.getAllUsers() actually returns
  const [userList, setUserList] = useState<Array<{ id: string; name: string; email?: string; role?: string }>>([]);
  const [listLoading, setListLoading] = useState(true);

  useEffect(() => {
    if (!currentUser || currentUser.role !== "Admin") {
      navigate("/dashboard");
      return;
    }
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setListLoading(true);
    try {
      // FIX: Changed users.list() to auth.getAllUsers()
      const data = await auth.getAllUsers();
      setUserList(data);
    } catch {
      // non-critical
    } finally {
      setListLoading(false);
    }
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      // FIX: Changed users.create to auth.register
      await auth.register(form.fullName, form.email, form.password, form.role);
      setSuccess(`User "${form.fullName}" created successfully.`);
      setForm({ fullName: "", email: "", password: "", role: "IT Staff" });
      fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create user.");
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
        <div style={{ maxWidth: "960px", margin: "0 auto" }}>
          {/* Header */}
          <div style={{ marginBottom: "28px" }}>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
              User Management
            </h1>
            <p style={{ color: "#64748b", marginTop: "4px", fontSize: "0.875rem" }}>
              Create new accounts and manage system users
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
            {/* Create User Form */}
            <div style={{ backgroundColor: "white", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ padding: "8px", backgroundColor: "#eff6ff", borderRadius: "8px" }}>
                  <UserPlus size={18} color="#2563eb" />
                </div>
                <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "#0f172a" }}>
                  Create New User
                </h2>
              </div>

              <form onSubmit={handleSubmit} style={{ padding: "24px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div>
                    <label style={labelStyle}>Full Name</label>
                    <input name="fullName" value={form.fullName} onChange={handleChange} placeholder="John Doe" required style={fieldStyle} />
                  </div>

                  <div>
                    <label style={labelStyle}>Email Address</label>
                    <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="john@company.com" required style={fieldStyle} />
                  </div>

                  <div>
                    <label style={labelStyle}>Password</label>
                    <input name="password" type="password" value={form.password} onChange={handleChange} placeholder="Min. 6 characters" required minLength={6} style={fieldStyle} />
                  </div>

                  <div>
                    <label style={labelStyle}>Role</label>
                    <select name="role" value={form.role} onChange={handleChange} style={fieldStyle}>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  {error && <div style={{ padding: "10px 14px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", color: "#dc2626", fontSize: "0.8125rem" }}>{error}</div>}
                  {success && <div style={{ padding: "10px 14px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", color: "#15803d", fontSize: "0.8125rem" }}>{success}</div>}

                  <button type="submit" disabled={loading} style={{ width: "100%", padding: "11px", backgroundColor: loading ? "#93c5fd" : "#2563eb", color: "white", border: "none", borderRadius: "8px", fontSize: "0.875rem", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", marginTop: "4px" }}>
                    {loading ? "Creating…" : "Create User"}
                  </button>
                </div>
              </form>
            </div>

            {/* User List */}
            <div style={{ backgroundColor: "white", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0" }}>
                <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "#0f172a" }}>
                  All Users
                  <span style={{ marginLeft: "8px", padding: "2px 8px", backgroundColor: "#f1f5f9", borderRadius: "999px", fontSize: "0.75rem", color: "#64748b", fontWeight: 500 }}>
                    {userList.length}
                  </span>
                </h2>
              </div>

              <div style={{ maxHeight: "480px", overflowY: "auto" }}>
                {listLoading ? (
                  <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>Loading users…</div>
                ) : userList.length === 0 ? (
                  <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>No users found.</div>
                ) : (
                  userList.map((u, i) => (
                    // FIX: Changed u._id to u.id, u.fullName to u.name
                    <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", borderBottom: i < userList.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: "0.875rem", flexShrink: 0 }}>
                          {u.name?.charAt(0).toUpperCase() || "?"}
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, color: "#0f172a" }}>
                            {u.name}
                          </p>
                          <p style={{ margin: "1px 0 0", fontSize: "0.75rem", color: "#94a3b8" }}>
                            {/* FIX: Handled potentially missing email field */}
                            {u.email || "No Email Provided"}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        {/* FIX: Handled potentially missing role field */}
                        {roleBadge(u.role || "Employee")}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}