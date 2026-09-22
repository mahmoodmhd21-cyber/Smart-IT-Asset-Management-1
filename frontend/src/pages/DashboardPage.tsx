import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import AuthGuard from "../components/AuthGuard";
import { assets, allocations, getCurrentUser, type Asset, type Allocation } from "../lib/api";
import { Server, GitBranch, CheckCircle, AlertCircle, Plus } from "lucide-react";

export default function DashboardPage() {
  const [assetList, setAssetList] = useState<Asset[]>([]);
  const [allocationList, setAllocationList] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const user = getCurrentUser();

  useEffect(() => {
    Promise.all([assets.list(), allocations.list()])
      .then(([a, al]) => {
        setAssetList(Array.isArray(a) ? a : []);
        setAllocationList(Array.isArray(al) ? al : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const total = assetList.length;
  const available = assetList.filter((a) => a.status === "Available").length;
  const allocated = assetList.filter((a) => a.status === "Allocated").length;
  const maintenance = assetList.filter((a) => a.status === "Maintenance").length;

  const stats = [
    { label: "Total Assets", value: total, icon: Server, color: "#2563eb", bg: "#eff6ff" },
    { label: "Available", value: available, icon: CheckCircle, color: "#16a34a", bg: "#f0fdf4" },
    { label: "Allocated", value: allocated, icon: GitBranch, color: "#d97706", bg: "#fffbeb" },
    { label: "Maintenance", value: maintenance, icon: AlertCircle, color: "#dc2626", bg: "#fef2f2" },
  ];

  const recentAllocations = allocationList
    .filter((al) => al.allocationStatus === "Allocated")
    .slice(0, 5);

  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8 overflow-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold" style={{ color: "#111827" }}>
              Welcome back, {user?.fullName?.split(" ")[0] || "User"} 👋
            </h1>
            <p className="text-sm mt-1" style={{ color: "#6b7280" }}>
              Here's what's happening with your IT assets.
            </p>
          </div>

          {loading ? (
            <div style={{ color: "#9ca3af" }} className="text-sm">
              Loading...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                {stats.map(({ label, value, icon: Icon, color, bg }) => (
                  <div
                    key={label}
                    className="rounded-xl p-6"
                    style={{ backgroundColor: "white", border: "1px solid #f3f4f6", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-medium" style={{ color: "#6b7280" }}>
                        {label}
                      </span>
                      <div className="p-2 rounded-lg" style={{ backgroundColor: bg }}>
                        <Icon size={18} color={color} />
                      </div>
                    </div>
                    <p className="text-3xl font-bold" style={{ color: "#111827" }}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div
                  className="lg:col-span-2 rounded-xl"
                  style={{ backgroundColor: "white", border: "1px solid #f3f4f6", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                >
                  <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #f9fafb" }}>
                    <h2 className="text-base font-semibold" style={{ color: "#111827" }}>
                      Active Allocations
                    </h2>
                    <Link to="/allocations" className="text-sm" style={{ color: "#2563eb" }}>
                      View all
                    </Link>
                  </div>
                  <div>
                    {recentAllocations.length === 0 ? (
                      <p className="px-6 py-8 text-sm text-center" style={{ color: "#9ca3af" }}>
                        No active allocations
                      </p>
                    ) : (
                      recentAllocations.map((al) => (
                        <div
                          key={al._id}
                          className="px-6 py-4 flex items-center justify-between"
                          style={{ borderBottom: "1px solid #f9fafb" }}
                        >
                          <div>
                            <p className="text-sm font-medium" style={{ color: "#111827" }}>
                              {al.asset?.assetName || "Unknown Asset"}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: "#6b7280" }}>
                              Assigned to {al.user?.fullName || "Unknown"}
                            </p>
                          </div>
                          <span
                            className="text-xs px-2.5 py-1 rounded-full font-medium"
                            style={{ backgroundColor: "#fffbeb", color: "#b45309" }}
                          >
                            {al.allocationStatus}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div
                  className="rounded-xl p-6"
                  style={{ backgroundColor: "white", border: "1px solid #f3f4f6", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                >
                  <h2 className="text-base font-semibold mb-4" style={{ color: "#111827" }}>
                    Quick Actions
                  </h2>
                  <div className="space-y-3">
                    <Link
                      to="/assets/add"
                      className="flex items-center gap-3 w-full p-3 rounded-lg text-sm font-medium transition-colors"
                      style={{ backgroundColor: "#eff6ff", color: "#1d4ed8" }}
                    >
                      <Plus size={16} />
                      Add New Asset
                    </Link>
                    <Link
                      to="/allocations"
                      className="flex items-center gap-3 w-full p-3 rounded-lg text-sm font-medium"
                      style={{ backgroundColor: "#f9fafb", color: "#374151" }}
                    >
                      <GitBranch size={16} />
                      Manage Allocations
                    </Link>
                    <Link
                      to="/assets"
                      className="flex items-center gap-3 w-full p-3 rounded-lg text-sm font-medium"
                      style={{ backgroundColor: "#f9fafb", color: "#374151" }}
                    >
                      <Server size={16} />
                      View All Assets
                    </Link>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
