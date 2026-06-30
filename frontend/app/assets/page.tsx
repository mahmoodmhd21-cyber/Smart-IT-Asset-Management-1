"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import AuthGuard from "@/components/AuthGuard";
import { assets, type Asset } from "@/lib/api";
import { Plus, Pencil, Trash2, Search } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  Available: "bg-green-100 text-green-700",
  Allocated: "bg-amber-100 text-amber-700",
  Maintenance: "bg-red-100 text-red-700",
  Retired: "bg-gray-100 text-gray-600",
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
    assets.list()
      .then((data) => { setList(data); setFiltered(data); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let result = list;
    if (statusFilter !== "All") result = result.filter((a) => a.status === statusFilter);
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
      <div className="flex h-full min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8 overflow-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Asset Inventory</h1>
              <p className="text-gray-500 text-sm mt-1">{list.length} total assets</p>
            </div>
            <Link
              href="/assets/add"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus size={16} />
              Add Asset
            </Link>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-gray-100">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search assets..."
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {["All", "Available", "Allocated", "Maintenance", "Retired"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className="p-12 text-center text-gray-400 text-sm">Loading assets...</div>
            ) : error ? (
              <div className="p-12 text-center text-red-500 text-sm">{error}</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-sm">No assets found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                      <th className="px-6 py-3 font-medium">Asset Name</th>
                      <th className="px-6 py-3 font-medium">Category</th>
                      <th className="px-6 py-3 font-medium">Brand / Model</th>
                      <th className="px-6 py-3 font-medium">Location</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map((asset) => (
                      <tr key={asset._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">{asset.assetName}</td>
                        <td className="px-6 py-4 text-gray-500">{asset.category || "—"}</td>
                        <td className="px-6 py-4 text-gray-500">
                          {[asset.brand, asset.model].filter(Boolean).join(" / ") || "—"}
                        </td>
                        <td className="px-6 py-4 text-gray-500">{asset.location || "—"}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[asset.status] || "bg-gray-100 text-gray-600"}`}>
                            {asset.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/assets/${asset._id}/edit`}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Pencil size={15} />
                            </Link>
                            <button
                              onClick={() => handleDelete(asset._id)}
                              disabled={deleting === asset._id}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
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
    </AuthGuard>
  );
}
