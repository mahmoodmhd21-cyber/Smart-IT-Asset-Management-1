import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import AuthGuard from "../components/AuthGuard";
import { allocations, assets, auth, type Allocation, type Asset } from "../lib/api";
import { Plus, RotateCcw, Trash2, X } from "lucide-react";

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  Allocated: { bg: "#fffbeb", color: "#b45309" },
  Returned: { bg: "#f0fdf4", color: "#15803d" },
  Pending: { bg: "#eff6ff", color: "#1d4ed8" },
};

const inputStyle = {
  width: "100%",
  padding: "10px 16px",
  fontSize: "0.875rem",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  outline: "none",
  boxSizing: "border-box" as const,
};

export default function AllocationsPage() {
  const [list, setList] = useState<Allocation[]>([]);
  const [availableAssets, setAvailableAssets] = useState<Asset[]>([]);
  // Updated state type to match the minimal user array format
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    asset: "",
    user: "",
    allocationDate: new Date().toISOString().split("T")[0],
    remarks: "",
  });

  function loadData() {
    setLoading(true);
    // Swapped auth.me() with auth.getAllUsers()
    Promise.all([allocations.list(), assets.list(), auth.getAllUsers()])
      .then(([al, ass, usersData]) => {
        setList(al);
        setAvailableAssets(ass.filter((a) => a.status === "Available"));
        setUsers(usersData);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.asset) { setFormError("Please select an asset."); return; }
    if (!form.user) { setFormError("Please select a user."); return; }
    setFormError("");
    setSubmitting(true);
    try {
      await allocations.create(form);
      setShowModal(false);
      setForm({ asset: "", user: "", allocationDate: new Date().toISOString().split("T")[0], remarks: "" });
      loadData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create allocation");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReturn(id: string) {
    if (!confirm("Mark this asset as returned?")) return;
    try {
      await allocations.returnAsset(id);
      loadData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to return asset");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this allocation record?")) return;
    try {
      await allocations.remove(id);
      setList((prev) => prev.filter((a) => a._id !== id));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8 overflow-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "#111827" }}>
                Allocations
              </h1>
              <p className="text-sm mt-1" style={{ color: "#6b7280" }}>
                {list.length} total records
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg"
              style={{ backgroundColor: "#2563eb" }}
            >
              <Plus size={16} />
              New Allocation
            </button>
          </div>

          <div
            className="rounded-xl overflow-hidden"
            style={{ backgroundColor: "white", border: "1px solid #f3f4f6", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
          >
            {loading ? (
              <div className="p-12 text-center text-sm" style={{ color: "#9ca3af" }}>Loading allocations...</div>
            ) : error ? (
              <div className="p-12 text-center text-sm" style={{ color: "#dc2626" }}>{error}</div>
            ) : list.length === 0 ? (
              <div className="p-12 text-center text-sm" style={{ color: "#9ca3af" }}>No allocations yet</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide" style={{ borderBottom: "1px solid #f3f4f6", color: "#6b7280" }}>
                      <th className="px-6 py-3 font-medium">Asset</th>
                      <th className="px-6 py-3 font-medium">Assigned To</th>
                      <th className="px-6 py-3 font-medium">Alloc. Date</th>
                      <th className="px-6 py-3 font-medium">Return Date</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Remarks</th>
                      <th className="px-6 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((al) => {
                      const s = STATUS_STYLES[al.allocationStatus] || { bg: "#f9fafb", color: "#6b7280" };
                      return (
                        <tr key={al._id} style={{ borderBottom: "1px solid #f9fafb" }}>
                          <td className="px-6 py-4 font-medium" style={{ color: "#111827" }}>
                            {al.asset?.assetName || "Unknown"}
                          </td>
                          <td className="px-6 py-4" style={{ color: "#374151" }}>
                            <div>{al.user?.fullName || "Unknown"}</div>
                            <div className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>{al.user?.email || ""}</div>
                          </td>
                          <td className="px-6 py-4" style={{ color: "#6b7280" }}>
                            {al.allocationDate ? new Date(al.allocationDate).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-6 py-4" style={{ color: "#6b7280" }}>
                            {al.returnDate ? new Date(al.returnDate).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: s.bg, color: s.color }}>
                              {al.allocationStatus}
                            </span>
                          </td>
                          <td className="px-6 py-4 max-w-xs" style={{ color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {al.remarks || "—"}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {al.allocationStatus === "Allocated" && (
                                <button onClick={() => handleReturn(al._id)} className="p-1.5 rounded-lg" style={{ color: "#9ca3af" }} title="Return">
                                  <RotateCcw size={15} />
                                </button>
                              )}
                              <button onClick={() => handleDelete(al._id)} className="p-1.5 rounded-lg" style={{ color: "#9ca3af" }} title="Delete">
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #f3f4f6" }}>
              <h2 className="text-base font-semibold" style={{ color: "#111827" }}>New Allocation</h2>
              <button onClick={() => setShowModal(false)} style={{ color: "#9ca3af" }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#374151" }}>Asset *</label>
                <select name="asset" value={form.asset} onChange={handleChange} style={{ ...inputStyle, backgroundColor: "white" }}>
                  <option value="">Select available asset</option>
                  {availableAssets.map((a) => (
                    <option key={a._id} value={a._id}>{a.assetName}</option>
                  ))}
                </select>
                {availableAssets.length === 0 && (
                  <p className="text-xs mt-1" style={{ color: "#d97706" }}>No available assets to allocate.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#374151" }}>Assign To *</label>
                {/* Updated dropdown mapping to use u.id and u.name */}
                <select name="user" value={form.user} onChange={handleChange} style={{ ...inputStyle, backgroundColor: "white" }}>
                  <option value="">Select user</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#374151" }}>Allocation Date *</label>
                <input name="allocationDate" type="date" value={form.allocationDate} onChange={handleChange} required style={inputStyle} />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#374151" }}>Remarks</label>
                <textarea
                  name="remarks"
                  value={form.remarks}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Optional notes..."
                  style={{ ...inputStyle, resize: "none" }}
                />
              </div>

              {formError && (
                <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 text-white text-sm font-medium rounded-lg"
                  style={{ backgroundColor: submitting ? "#93c5fd" : "#2563eb" }}
                >
                  {submitting ? "Allocating..." : "Create Allocation"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 text-sm font-medium rounded-lg"
                  style={{ border: "1px solid #d1d5db", color: "#374151" }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AuthGuard>
  );
}