import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import AuthGuard from "../components/AuthGuard";
import { assets, type Asset } from "../lib/api";
import { ArrowLeft } from "lucide-react";

const CATEGORIES = ["Laptop", "Desktop", "Monitor", "Printer", "Server", "Networking", "Phone", "Tablet", "Other"];
const STATUSES = ["Available", "Allocated", "Maintenance", "Retired"];

const inputStyle = {
  width: "100%",
  padding: "10px 16px",
  fontSize: "0.875rem",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  outline: "none",
  boxSizing: "border-box" as const,
};

export default function EditAssetPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

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
    assets
      .get(id)
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

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.assetName.trim()) {
      setError("Asset name is required.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await assets.update(id!, form);
      navigate("/assets");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update asset");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8 overflow-auto">
          <div className="mb-6">
            <Link
              to="/assets"
              className="flex items-center gap-1.5 text-sm mb-4"
              style={{ color: "#6b7280" }}
            >
              <ArrowLeft size={16} /> Back to Assets
            </Link>
            <h1 className="text-2xl font-bold" style={{ color: "#111827" }}>
              Edit Asset
            </h1>
          </div>

          <div
            className="max-w-2xl rounded-xl p-8"
            style={{ backgroundColor: "white", border: "1px solid #f3f4f6", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
          >
            {loading ? (
              <div className="text-sm py-8 text-center" style={{ color: "#9ca3af" }}>
                Loading asset...
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 mb-5">
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="block text-sm font-medium mb-1" style={{ color: "#374151" }}>
                      Asset Name *
                    </label>
                    <input name="assetName" value={form.assetName} onChange={handleChange} required style={inputStyle} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "#374151" }}>Category</label>
                    <select name="category" value={form.category} onChange={handleChange} style={{ ...inputStyle, backgroundColor: "white" }}>
                      <option value="">Select category</option>
                      {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "#374151" }}>Status</label>
                    <select name="status" value={form.status} onChange={handleChange} style={{ ...inputStyle, backgroundColor: "white" }}>
                      {STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "#374151" }}>Brand</label>
                    <input name="brand" value={form.brand} onChange={handleChange} style={inputStyle} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "#374151" }}>Model</label>
                    <input name="model" value={form.model} onChange={handleChange} style={inputStyle} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "#374151" }}>Location</label>
                    <input name="location" value={form.location} onChange={handleChange} style={inputStyle} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "#374151" }}>Purchase Date</label>
                    <input name="purchaseDate" type="date" value={form.purchaseDate} onChange={handleChange} style={inputStyle} />
                  </div>
                </div>

                {error && (
                  <div className="p-3 rounded-lg text-sm mb-5" style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 text-white text-sm font-medium rounded-lg"
                    style={{ backgroundColor: saving ? "#93c5fd" : "#2563eb" }}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <Link
                    to="/assets"
                    className="px-6 py-2.5 text-sm font-medium rounded-lg"
                    style={{ border: "1px solid #d1d5db", color: "#374151" }}
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
