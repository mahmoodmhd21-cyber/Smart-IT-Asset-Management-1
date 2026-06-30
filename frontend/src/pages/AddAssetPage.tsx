import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import AuthGuard from "../components/AuthGuard";
import { assets } from "../lib/api";
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

export default function AddAssetPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    assetName: "",
    category: "",
    brand: "",
    model: "",
    location: "",
    status: "Available",
    purchaseDate: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    setLoading(true);
    try {
      await assets.create(form);
      navigate("/assets");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create asset");
    } finally {
      setLoading(false);
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
              Add New Asset
            </h1>
          </div>

          <div
            className="max-w-2xl rounded-xl p-8"
            style={{ backgroundColor: "white", border: "1px solid #f3f4f6", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
          >
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 mb-5">
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="block text-sm font-medium mb-1" style={{ color: "#374151" }}>
                    Asset Name *
                  </label>
                  <input
                    name="assetName"
                    value={form.assetName}
                    onChange={handleChange}
                    placeholder="e.g. Dell Laptop XPS-001"
                    required
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "#374151" }}>
                    Category
                  </label>
                  <select name="category" value={form.category} onChange={handleChange} style={{ ...inputStyle, backgroundColor: "white" }}>
                    <option value="">Select category</option>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "#374151" }}>
                    Status
                  </label>
                  <select name="status" value={form.status} onChange={handleChange} style={{ ...inputStyle, backgroundColor: "white" }}>
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "#374151" }}>
                    Brand
                  </label>
                  <input name="brand" value={form.brand} onChange={handleChange} placeholder="e.g. Dell, Apple" style={inputStyle} />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "#374151" }}>
                    Model
                  </label>
                  <input name="model" value={form.model} onChange={handleChange} placeholder="e.g. XPS 15" style={inputStyle} />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "#374151" }}>
                    Location
                  </label>
                  <input name="location" value={form.location} onChange={handleChange} placeholder="e.g. Office A, Floor 3" style={inputStyle} />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "#374151" }}>
                    Purchase Date
                  </label>
                  <input name="purchaseDate" type="date" value={form.purchaseDate} onChange={handleChange} style={inputStyle} />
                </div>
              </div>

              {error && (
                <div
                  className="p-3 rounded-lg text-sm mb-5"
                  style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}
                >
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 text-white text-sm font-medium rounded-lg"
                  style={{ backgroundColor: loading ? "#93c5fd" : "#2563eb" }}
                >
                  {loading ? "Saving..." : "Create Asset"}
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
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
