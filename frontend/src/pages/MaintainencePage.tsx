import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import AuthGuard from "../components/AuthGuard";
import { maintenance, assets, type Asset, type MaintenanceRecord } from "../lib/api";
import { Wrench, Plus, Pencil, Trash2, X, CheckCircle, Clock, AlertCircle } from "lucide-react";

const TYPE_OPTIONS = ["Repair", "Upgrade", "Inspection", "Replacement", "Cleaning"] as const;
const STATUS_OPTIONS = ["Scheduled", "In Progress", "Completed", "Cancelled"] as const;

const STATUS_STYLES: Record<string, { bg: string; color: string; icon: typeof CheckCircle }> = {
  Scheduled: { bg: "#dbeafe", color: "#1d4ed8", icon: Clock },
  "In Progress": { bg: "#fef9c3", color: "#a16207", icon: AlertCircle },
  Completed: { bg: "#dcfce7", color: "#15803d", icon: CheckCircle },
  Cancelled: { bg: "#f1f5f9", color: "#64748b", icon: X },
};

// FIX: Updated initial keys to match Mongoose schema properties
const emptyForm = {
  asset: "",
  maintenanceType: "Repair" as MaintenanceRecord["maintenanceType"],
  maintenanceDate: "",
  nextMaintenanceDate: "",
  serviceProvider: "",
  cost: 0,
  status: "Scheduled" as MaintenanceRecord["status"],
  description: "",
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
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
  marginBottom: "4px",
};

export default function MaintenancePage() {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [assetList, setAssetList] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<MaintenanceRecord | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    Promise.all([maintenance.list(), assets.list()])
      .then(([m, a]) => {
        setRecords(Array.isArray(m) ? (m as MaintenanceRecord[]) : []);
        setAssetList(Array.isArray(a) ? a : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function fetchRecords() {
    try {
      const data = await maintenance.list();
      setRecords(Array.isArray(data) ? (data as MaintenanceRecord[]) : []);
    } catch (e) {
      console.error(e);
    }
  }

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setShowModal(true);
  }

  function openEdit(r: MaintenanceRecord) {
    setEditing(r);
    // FIX: Map database field names cleanly to internal state when opening modal
    setForm({
      asset: typeof r.asset === "object" && r.asset ? r.asset._id : (r.asset as string),
      maintenanceType: r.maintenanceType,
      maintenanceDate: r.maintenanceDate ? r.maintenanceDate.split("T")[0] : "",
      nextMaintenanceDate: r.nextMaintenanceDate ? r.nextMaintenanceDate.split("T")[0] : "",
      serviceProvider: r.serviceProvider || "",
      cost: r.cost,
      status: r.status,
      description: r.description || "",
    });
    setError("");
    setShowModal(true);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value, type } = e.target;
    setForm((f) => ({ ...f, [name]: type === "number" ? Number(value) : value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (editing) {
        await maintenance.update(editing._id, form as any);
      } else {
        await maintenance.create(form as any);
      }
      setShowModal(false);
      fetchRecords();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save record.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this maintenance record?")) return;
    try {
      await maintenance.remove(id);
      fetchRecords();
    } catch (e) {
      console.error(e);
    }
  }

  const filtered = statusFilter === "All" ? records : records.filter((r) => r.status === statusFilter);

  const counts = {
    All: records.length,
    Scheduled: records.filter((r) => r.status === "Scheduled").length,
    "In Progress": records.filter((r) => r.status === "In Progress").length,
    Completed: records.filter((r) => r.status === "Completed").length,
    Cancelled: records.filter((r) => r.status === "Cancelled").length,
  };

  return (
    <AuthGuard>
      <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f8fafc" }}>
        <Sidebar />
        <main style={{ flex: 1, padding: "32px", overflowY: "auto" }}>
          <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
              <div>
                <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                  Maintenance Records
                </h1>
                <p style={{ color: "#64748b", marginTop: "4px", fontSize: "0.875rem" }}>
                  Schedule and track asset maintenance activities
                </p>
              </div>
              <button
                onClick={openAdd}
                style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 18px", backgroundColor: "#2563eb", color: "white", border: "none", borderRadius: "8px", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}
              >
                <Plus size={16} />
                New Record
              </button>
            </div>

            {/* Status filter tabs */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
              {(["All", "Scheduled", "In Progress", "Completed", "Cancelled"] as const).map((s) => {
                const style = s === "All" ? { color: "#475569" } : STATUS_STYLES[s];
                const active = statusFilter === s;
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    style={{
                      padding: "7px 14px",
                      borderRadius: "999px",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      border: "none",
                      backgroundColor: active ? (s === "All" ? "#0f172a" : style.color) : "#f1f5f9",
                      color: active ? "white" : "#64748b",
                      transition: "all 0.15s",
                    }}
                  >
                    {s} ({counts[s] ?? 0})
                  </button>
                );
              })}
            </div>

            {/* Table */}
            <div style={{ backgroundColor: "white", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    {["Asset", "Type", "Service Provider", "Scheduled Date", "Cost", "Status", ""].map((h) => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.75rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} style={{ padding: "48px", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>Loading records…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: "48px", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>
                      <Wrench size={32} style={{ margin: "0 auto 8px", color: "#cbd5e1" }} />
                      <p style={{ margin: 0 }}>No maintenance records {statusFilter !== "All" ? `with status "${statusFilter}"` : "yet"}.</p>
                    </td></tr>
                  ) : (
                    filtered.map((r, i) => {
                      const s = STATUS_STYLES[r.status] || STATUS_STYLES.Scheduled;
                      const Icon = s.icon;
                      const assetName = typeof r.asset === "object" && r.asset ? r.asset.assetName : "—";
                      return (
                        <tr key={r._id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <div style={{ padding: "6px", backgroundColor: "#f0fdf4", borderRadius: "6px" }}>
                                <Wrench size={14} color="#15803d" />
                              </div>
                              <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0f172a" }}>{assetName}</span>
                            </div>
                          </td>
                          <td style={{ padding: "14px 16px", fontSize: "0.875rem", color: "#64748b" }}>{r.maintenanceType}</td>
                          {/* FIX: Swapped technician to serviceProvider */}
                          <td style={{ padding: "14px 16px", fontSize: "0.875rem", color: "#64748b" }}>{r.serviceProvider || "—"}</td>
                          <td style={{ padding: "14px 16px", fontSize: "0.875rem", color: "#64748b" }}>
                            {/* FIX: Swapped scheduledDate to maintenanceDate */}
                            {r.maintenanceDate ? new Date(r.maintenanceDate).toLocaleDateString() : "—"}
                          </td>
                          <td style={{ padding: "14px 16px", fontSize: "0.875rem", fontWeight: 600, color: "#0f172a" }}>
                            {r.cost > 0 ? `$${r.cost.toLocaleString()}` : "—"}
                          </td>
                          <td style={{ padding: "14px 16px" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 10px", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 600, backgroundColor: s.bg, color: s.color }}>
                              <Icon size={11} />
                              {r.status}
                            </span>
                          </td>
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button onClick={() => openEdit(r)} style={{ padding: "6px", backgroundColor: "#f1f5f9", border: "none", borderRadius: "6px", cursor: "pointer" }}>
                                <Pencil size={14} color="#475569" />
                              </button>
                              <button onClick={() => handleDelete(r._id)} style={{ padding: "6px", backgroundColor: "#fef2f2", border: "none", borderRadius: "6px", cursor: "pointer" }}>
                                <Trash2 size={14} color="#dc2626" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "16px" }}>
          <div style={{ backgroundColor: "white", borderRadius: "16px", width: "100%", maxWidth: "560px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 50px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid #e2e8f0" }}>
              <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: "#0f172a" }}>
                {editing ? "Edit Record" : "New Maintenance Record"}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} color="#94a3b8" />
              </button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: "24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={labelStyle}>Asset *</label>
                  <select name="asset" value={form.asset} onChange={handleChange} required style={fieldStyle}>
                    <option value="">Select asset…</option>
                    {assetList.map((a) => <option key={a._id} value={a._id}>{a.assetName}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Maintenance Type</label>
                  <select name="maintenanceType" value={form.maintenanceType} onChange={handleChange} style={fieldStyle}>
                    {TYPE_OPTIONS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select name="status" value={form.status} onChange={handleChange} style={fieldStyle}>
                    {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  {/* FIX: Input mapped to maintenanceDate instead of scheduledDate */}
                  <label style={labelStyle}>Scheduled Date *</label>
                  <input name="maintenanceDate" type="date" value={form.maintenanceDate} onChange={handleChange} required style={fieldStyle} />
                </div>
                <div>
                  {/* FIX: Input mapped to nextMaintenanceDate instead of completedDate */}
                  <label style={labelStyle}>Next/Completion Date</label>
                  <input name="nextMaintenanceDate" type="date" value={form.nextMaintenanceDate} onChange={handleChange} style={fieldStyle} />
                </div>
                <div>
                  {/* FIX: Input mapped to serviceProvider instead of technician */}
                  <label style={labelStyle}>Service Provider / Technician</label>
                  <input name="serviceProvider" value={form.serviceProvider} onChange={handleChange} style={fieldStyle} placeholder="Technician or company" />
                </div>
                <div>
                  <label style={labelStyle}>Cost ($)</label>
                  <input name="cost" type="number" min={0} value={form.cost} onChange={handleChange} style={fieldStyle} />
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={labelStyle}>Description</label>
                  <textarea name="description" value={form.description} onChange={handleChange} rows={3} style={{ ...fieldStyle, resize: "vertical" }} placeholder="What needs to be done…" />
                </div>
                {/* FIX: Removed the non-whitelisted "Notes" text area since Mongoose controller drops it */}
              </div>

              {error && <div style={{ marginTop: "12px", padding: "10px 14px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", color: "#dc2626", fontSize: "0.8125rem" }}>{error}</div>}

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "20px" }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: "10px 20px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "0.875rem", backgroundColor: "white", cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ padding: "10px 20px", backgroundColor: saving ? "#93c5fd" : "#2563eb", color: "white", border: "none", borderRadius: "8px", fontSize: "0.875rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
                  {saving ? "Saving…" : editing ? "Update" : "Create Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AuthGuard>
  );
}