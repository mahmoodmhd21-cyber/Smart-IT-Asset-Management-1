import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import AuthGuard from "../components/AuthGuard";
import { assets, type Asset } from "../lib/api";
import { Plus, Pencil, Trash2, Search } from "lucide-react";

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  Available: { bg: "#f0fdf4", color: "#15803d" },
  Allocated: { bg: "#fffbeb", color: "#b45309" },
  Maintenance: { bg: "#fef2f2", color: "#dc2626" },
  Retired: { bg: "#f9fafb", color: "#6b7280" },
};

export default function AssetsPage() {
  const [list, setList] = useState<Asset[]>([]);
  const [filtered, setFiltered] = useState<Asset[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    assets
      .list()
      .then((data) => {
        setList(data);
        setFiltered(data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let result = list;
    if (statusFilter !== "All")
      result = result.filter((a) => a.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.assetName?.toLowerCase().includes(q) ||
          a.brand?.toLowerCase().includes(q) ||
          a.model?.toLowerCase().includes(q) ||
          a.category?.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [search, statusFilter, list]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this asset? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await assets.remove(id);
      setList((prev) => prev.filter((a) => a._id !== id));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(null);
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
                Asset Inventory
              </h1>
              <p className="text-sm mt-1" style={{ color: "#6b7280" }}>
                {list.length} total assets
              </p>
            </div>
            <Link
              to="/assets/add"
              className="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg"
              style={{ backgroundColor: "#2563eb" }}
            >
              <Plus size={16} />
              Add Asset
            </Link>
          </div>

          <div
            className="rounded-xl overflow-hidden"
            style={{ backgroundColor: "white", border: "1px solid #f3f4f6", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
          >
            <div
              className="flex flex-col sm:flex-row gap-3 p-4"
              style={{ borderBottom: "1px solid #f3f4f6" }}
            >
              <div className="relative flex-1">
                <Search
                  size={16}
                  style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }}
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search assets..."
                  className="w-full rounded-lg border text-sm outline-none"
                  style={{ paddingLeft: "36px", paddingRight: "16px", paddingTop: "8px", paddingBottom: "8px", borderColor: "#e5e7eb" }}
                  onFocus={(e) => (e.target.style.borderColor = "#2563eb")}
                  onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border outline-none bg-white"
                style={{ borderColor: "#e5e7eb" }}
              >
                {["All", "Available", "Allocated", "Maintenance", "Retired"].map(
                  (s) => (
                    <option key={s}>{s}</option>
                  )
                )}
              </select>
            </div>

            {loading ? (
              <div className="p-12 text-center text-sm" style={{ color: "#9ca3af" }}>
                Loading assets...
              </div>
            ) : error ? (
              <div className="p-12 text-center text-sm" style={{ color: "#dc2626" }}>
                {error}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-sm" style={{ color: "#9ca3af" }}>
                No assets found
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr
                      className="text-left text-xs uppercase tracking-wide"
                      style={{ borderBottom: "1px solid #f3f4f6", color: "#6b7280" }}
                    >
                      <th className="px-6 py-3 font-medium">Asset Name</th>
                      <th className="px-6 py-3 font-medium">Category</th>
                      <th className="px-6 py-3 font-medium">Brand / Model</th>
                      <th className="px-6 py-3 font-medium">Location</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((asset) => {
                      const style = STATUS_STYLES[asset.status] || STATUS_STYLES.Retired;
                      return (
                        <tr
                          key={asset._id}
                          style={{ borderBottom: "1px solid #f9fafb" }}
                        >
                          <td className="px-6 py-4 font-medium" style={{ color: "#111827" }}>
                            {asset.assetName}
                          </td>
                          <td className="px-6 py-4" style={{ color: "#6b7280" }}>
                            {asset.category || "—"}
                          </td>
                          <td className="px-6 py-4" style={{ color: "#6b7280" }}>
                            {[asset.brand, asset.model].filter(Boolean).join(" / ") || "—"}
                          </td>
                          <td className="px-6 py-4" style={{ color: "#6b7280" }}>
                            {asset.location || "—"}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className="px-2.5 py-1 rounded-full text-xs font-medium"
                              style={{ backgroundColor: style.bg, color: style.color }}
                            >
                              {asset.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Link
                                to={`/assets/${asset._id}/edit`}
                                className="p-1.5 rounded-lg transition-colors"
                                style={{ color: "#9ca3af" }}
                                title="Edit"
                              >
                                <Pencil size={15} />
                              </Link>
                              <button
                                onClick={() => handleDelete(asset._id)}
                                disabled={deleting === asset._id}
                                className="p-1.5 rounded-lg transition-colors"
                                style={{ color: "#9ca3af" }}
                                title="Delete"
                              >
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
    </AuthGuard>
  );
}
