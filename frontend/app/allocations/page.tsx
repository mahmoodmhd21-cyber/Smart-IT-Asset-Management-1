"use client";
import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import AuthGuard from "@/components/AuthGuard";
import { allocations, assets, auth, type Allocation, type Asset, type User } from "@/lib/api";
import { Plus, RotateCcw, Trash2, X } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  Allocated: "bg-amber-100 text-amber-700",
  Returned: "bg-green-100 text-green-700",
  Pending: "bg-blue-100 text-blue-700",
};

export default function AllocationsPage() {
  const [list, setList] = useState<Allocation[]>([]);
  const [assetList, setAssetList] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({
    asset: "",
    user: "",
    allocationDate: new Date().toISOString().split("T")[0],
    remarks: "",
  });

  function loadData() {
    setLoading(true);
    Promise.all([allocations.list(), assets.list(), auth.me()])
      .then(([al, ass, meData]) => {
        setList(al);
        setAssetList(ass.filter((a) => a.status === "Available"));
        setUsers([meData.user]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
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
      <div className="flex h-full min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8 overflow-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Allocations</h1>
              <p className="text-gray-500 text-sm mt-1">{list.length} total records</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus size={16} />
              New Allocation
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            {loading ? (
              <div className="p-12 text-center text-gray-400 text-sm">Loading allocations...</div>
            ) : error ? (
              <div className="p-12 text-center text-red-500 text-sm">{error}</div>
            ) : list.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-sm">No allocations yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                      <th className="px-6 py-3 font-medium">Asset</th>
                      <th className="px-6 py-3 font-medium">Assigned To</th>
                      <th className="px-6 py-3 font-medium">Allocation Date</th>
                      <th className="px-6 py-3 font-medium">Return Date</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Remarks</th>
                      <th className="px-6 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {list.map((al) => (
                      <tr key={al._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {al.asset?.assetName || "Unknown"}
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          <div>{al.user?.fullName || "Unknown"}</div>
                          <div className="text-xs text-gray-400">{al.user?.email || ""}</div>
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          {al.allocationDate ? new Date(al.allocationDate).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          {al.returnDate ? new Date(al.returnDate).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[al.allocationStatus] || "bg-gray-100 text-gray-600"}`}>
                            {al.allocationStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-500 max-w-xs truncate">{al.remarks || "—"}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {al.allocationStatus === "Allocated" && (
                              <button
                                onClick={() => handleReturn(al._id)}
                                className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="Return Asset"
                              >
                                <RotateCcw size={15} />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(al._id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">New Allocation</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Asset *</label>
                <select
                  name="asset"
                  value={form.asset}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Select available asset</option>
                  {assetList.map((a) => (
                    <option key={a._id} value={a._id}>{a.assetName}</option>
                  ))}
                </select>
                {assetList.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">No available assets to allocate.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign To (User) *</label>
                <select
                  name="user"
                  value={form.user}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Select user</option>
                  {users.map((u) => (
                    <option key={u._id} value={u._id}>{u.fullName} ({u.email})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Allocation Date *</label>
                <input
                  name="allocationDate"
                  type="date"
                  value={form.allocationDate}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                <textarea
                  name="remarks"
                  value={form.remarks}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Optional notes..."
                  className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{formError}</div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {submitting ? "Allocating..." : "Create Allocation"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
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
