import { useEffect, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import AuthGuard from "../components/AuthGuard";
import LoadError from "../components/LoadError";
import { licenses, type License } from "../lib/api";
import { KeyRound, Plus, Pencil, Trash2, X, CheckCircle, AlertTriangle, Clock } from "lucide-react";

const TYPE_OPTIONS = ["Perpetual", "Subscription", "Trial", "Open Source"] as const;
const STATUS_OPTIONS = ["Active", "Expired", "Expiring Soon", "Suspended"] as const;

const STATUS_STYLES: Record<string, { bg: string; color: string; icon: typeof CheckCircle }> = {
  Active: { bg: "#dcfce7", color: "#15803d", icon: CheckCircle },
  Expired: { bg: "#fee2e2", color: "#dc2626", icon: X },
  Suspended: { bg: "#e5e7eb", color: "#374151", icon: Clock },
  "Expiring Soon": { bg: "#fef9c3", color: "#a16207", icon: AlertTriangle },
};

const emptyForm = {
  softwareName: "",
  vendor: "",
  licenseKey: "",
  licenseType: "Subscription" as License["licenseType"] | "",
  numberOfSeats: 1,
  assignedSeats: 0,
  purchaseDate: "",
  expiryDate: "",
  cost: 0 as number | "",
  status: "Active" as License["status"],
  notes: "",
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

export default function LicensePage() {
  const [licenseList, setLicenseList] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<License | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    fetchLicenses();
  }, []);

  async function fetchLicenses() {
    setLoading(true);
    setLoadError("");
    try {
      const data = await licenses.list();
      setLicenseList(Array.isArray(data) ? data : []);
    } catch (e) {
      setLoadError("Licenses could not be loaded. Displayed records may be out of date.");
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setShowModal(true);
  }

  function openEdit(l: License) {
    setEditing(l);
    setForm({
      softwareName: l.softwareName,
      vendor: l.vendor,
      licenseKey: l.licenseKey || "",
      licenseType: l.licenseType || "",
      numberOfSeats: l.numberOfSeats,
      assignedSeats: l.assignedSeats,
      purchaseDate: l.purchaseDate ? l.purchaseDate.split("T")[0] : "",
      expiryDate: l.expiryDate ? l.expiryDate.split("T")[0] : "",
      cost: l.cost ?? "",
      status: l.status,
      notes: l.notes || "",
    });
    setError("");
    setShowModal(true);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value, type } = e.target;
    setForm((f) => ({ ...f, [name]: type === "number" && value !== "" ? Number(value) : value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      // Preserve unknown historical values instead of inventing a type or purchase cost.
      const payload = { ...form, licenseType: form.licenseType || null, cost: form.cost === "" ? null : form.cost };
      if (editing) {
        await licenses.update(editing._id, payload);
      } else {
        await licenses.create(payload);
      }
      setShowModal(false);
      fetchLicenses();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save license.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this license?")) return;
    setActionError("");
    try {
      await licenses.remove(id);
      fetchLicenses();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not delete license.");
    }
  }

  return (
    <AuthGuard>
      <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f8fafc" }}>
        <Sidebar />
        <main style={{ flex: 1, padding: "32px", overflowY: "auto" }}>
          <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
            {loadError && <LoadError message={loadError} retry={fetchLicenses} />}
            {actionError && <p role="alert" className="mb-4 text-red-700">{actionError}</p>}
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
              <div>
                <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                  Software Licenses
                </h1>
                <p style={{ color: "#64748b", marginTop: "4px", fontSize: "0.875rem" }}>
                  Track and manage software licenses and subscriptions
                </p>
              </div>
              <button
                onClick={openAdd}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 18px",
                  backgroundColor: "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Plus size={16} />
                Add License
              </button>
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
                    {["Software", "Vendor", "Type", "numberOfSeats", "Expiry", "Cost", "Status", ""].map((h) => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.75rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} style={{ padding: "48px", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>Loading licenses…</td></tr>
                  ) : loadError ? <tr><td colSpan={8} className="p-5">License data unavailable.</td></tr> : licenseList.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding: "48px", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>
                      <KeyRound size={32} style={{ margin: "0 auto 8px", color: "#cbd5e1" }} />
                      <p style={{ margin: 0 }}>No licenses yet. Add your first one.</p>
                    </td></tr>
                  ) : (
                    licenseList.map((l, i) => {
                      const s = STATUS_STYLES[l.status] || STATUS_STYLES.Active;
                      const Icon = s.icon;
                      return (
                        <tr key={l._id} style={{ borderBottom: i < licenseList.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <div style={{ padding: "6px", backgroundColor: "#eff6ff", borderRadius: "6px" }}>
                                <KeyRound size={14} color="#2563eb" />
                              </div>
                              <div>
                                <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, color: "#0f172a" }}>{l.softwareName}</p>
                                {l.licenseKey && <p style={{ margin: 0, fontSize: "0.75rem", color: "#94a3b8", fontFamily: "monospace" }}>{l.licenseKey.slice(0, 16)}…</p>}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "14px 16px", fontSize: "0.875rem", color: "#64748b" }}>{l.vendor}</td>
                          <td style={{ padding: "14px 16px", fontSize: "0.875rem", color: "#64748b" }}>{l.licenseType || "Not recorded"}</td>
                          <td style={{ padding: "14px 16px", fontSize: "0.875rem", color: "#0f172a" }}>
                            <span style={{ fontWeight: 600 }}>{l.assignedSeats}</span>
                            <span style={{ color: "#94a3b8" }}>/{l.numberOfSeats}</span>
                          </td>
                          <td style={{ padding: "14px 16px", fontSize: "0.875rem", color: "#64748b" }}>
                            {l.expiryDate ? new Date(l.expiryDate).toLocaleDateString() : "—"}
                          </td>
                          <td style={{ padding: "14px 16px", fontSize: "0.875rem", color: "#0f172a", fontWeight: 600 }}>
                            {l.cost != null ? `$${l.cost.toLocaleString()}` : "Not recorded"}
                          </td>
                          <td style={{ padding: "14px 16px" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 10px", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 600, backgroundColor: s.bg, color: s.color }}>
                              <Icon size={11} />
                              {l.status}
                            </span>
                          </td>
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button onClick={() => openEdit(l)} style={{ padding: "6px", backgroundColor: "#f1f5f9", border: "none", borderRadius: "6px", cursor: "pointer" }}>
                                <Pencil size={14} color="#475569" />
                              </button>
                              <button aria-label={`Delete ${l.softwareName}`} title="Delete license" onClick={() => handleDelete(l._id)} style={{ padding: "6px", backgroundColor: "#fef2f2", border: "none", borderRadius: "6px", cursor: "pointer" }}>
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
          <div style={{ backgroundColor: "white", borderRadius: "16px", width: "100%", maxWidth: "580px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 50px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid #e2e8f0" }}>
              <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: "#0f172a" }}>
                {editing ? "Edit License" : "Add License"}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} color="#94a3b8" />
              </button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: "24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={labelStyle}>Software Name *</label>
                  <input name="softwareName" value={form.softwareName} onChange={handleChange} required style={fieldStyle} placeholder="e.g. Microsoft Office 365" />
                </div>
                <div>
                  <label style={labelStyle}>Vendor *</label>
                  <input name="vendor" value={form.vendor} onChange={handleChange} required style={fieldStyle} placeholder="Microsoft" />
                </div>
                <div>
                  <label style={labelStyle}>License Type</label>
                  <select name="licenseType" value={form.licenseType || ""} onChange={handleChange} style={fieldStyle}>
                    <option value="">Not recorded</option>
                    {TYPE_OPTIONS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={labelStyle}>License Key *</label>
                  <input name="licenseKey" required value={form.licenseKey} onChange={handleChange} style={fieldStyle} placeholder="XXXXX-XXXXX-XXXXX-XXXXX" />
                </div>
                <div>
                  <label style={labelStyle}>Purchased Seats *</label>
                  <input name="numberOfSeats" type="number" required min={0} step={1} value={form.numberOfSeats} onChange={handleChange} style={fieldStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Assigned Seats *</label>
                  <input name="assignedSeats" type="number" required min={0} max={form.numberOfSeats} step={1} value={form.assignedSeats} onChange={handleChange} style={fieldStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Purchase Date</label>
                  <input name="purchaseDate" type="date" value={form.purchaseDate} onChange={handleChange} style={fieldStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Expiry Date</label>
                  <input name="expiryDate" type="date" value={form.expiryDate} onChange={handleChange} style={fieldStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Cost ($)</label>
                  <input name="cost" type="number" min={0} step="0.01" value={form.cost} onChange={handleChange} style={fieldStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select name="status" value={form.status} onChange={handleChange} style={fieldStyle}>
                    {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={labelStyle}>Notes</label>
                  <textarea name="notes" value={form.notes} onChange={handleChange} rows={2} style={{ ...fieldStyle, resize: "vertical" }} placeholder="Additional notes…" />
                </div>
              </div>

              {error && <div style={{ marginTop: "12px", padding: "10px 14px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", color: "#dc2626", fontSize: "0.8125rem" }}>{error}</div>}

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "20px" }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: "10px 20px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "0.875rem", backgroundColor: "white", cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ padding: "10px 20px", backgroundColor: saving ? "#93c5fd" : "#2563eb", color: "white", border: "none", borderRadius: "8px", fontSize: "0.875rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
                  {saving ? "Saving…" : editing ? "Update" : "Add License"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AuthGuard>
  );
}
