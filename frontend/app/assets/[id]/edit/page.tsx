"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import AuthGuard from "@/components/AuthGuard";
import { assets, type Asset } from "@/lib/api";
import { ArrowLeft } from "lucide-react";

const CATEGORIES = ["Laptop", "Desktop", "Monitor", "Printer", "Server", "Networking", "Phone", "Tablet", "Other"];
const STATUSES = ["Available", "Allocated", "Maintenance", "Retired"];

export default function EditAssetPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [form, setForm] = useState({
    assetName: "",
    category: "",
    brand: "",
    model: "",
    location: "",
    status: "Available",
    purchaseDate: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    assets.get(id)
      .then((a: Asset) => {
        setForm({
          assetName: a.assetName || "",
          category: a.category || "",
          brand: a.brand || "",
          model: a.model || "",
          location: a.location || "",
          status: a.status || "Available",
          purchaseDate: a.purchaseDate ? a.purchaseDate.split("T")[0] : "",
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.assetName.trim()) { setError("Asset name is required."); return; }
    setError("");
    setSaving(true);
    try {
      await assets.update(id, form);
      router.push("/assets");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update asset");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthGuard>
      <div className="flex h-full min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8 overflow-auto">
          <div className="mb-6">
            <Link href="/assets" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4">
              <ArrowLeft size={16} /> Back to Assets
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Edit Asset</h1>
          </div>

          <div className="max-w-2xl bg-white rounded-xl border border-gray-100 shadow-sm p-8">
            {loading ? (
              <div className="text-sm text-gray-400 py-8 text-center">Loading asset...</div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Asset Name *</label>
                    <input
                      name="assetName"
                      value={form.assetName}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      name="category"
                      value={form.category}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">Select category</option>
                      {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      name="status"
                      value={form.status}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                    <input
                      name="brand"
                      value={form.brand}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                    <input
                      name="model"
                      value={form.model}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    <input
                      name="location"
                      value={form.location}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
                    <input
                      name="purchaseDate"
                      type="date"
                      value={form.purchaseDate}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <Link
                    href="/assets"
                    className="px-6 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                  >
                    Cancel
                  </Link>
                </div>
              </form>
            )}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
