"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import AuthGuard from "@/components/AuthGuard";
import { assets, allocations, getCurrentUser, type Asset, type Allocation } from "@/lib/api";
import { Server, GitBranch, CheckCircle, AlertCircle, Plus } from "lucide-react";

export default function DashboardPage() {
  const [assetList, setAssetList] = useState<Asset[]>([]);
  const [allocationList, setAllocationList] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const user = getCurrentUser();

  useEffect(() => {
    Promise.all([assets.list(), allocations.list()])
      .then(([a, al]) => {
        setAssetList(a);
        setAllocationList(al);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const total = assetList.length;
  const available = assetList.filter((a) => a.status === "Available").length;
  const allocated = assetList.filter((a) => a.status === "Allocated").length;
  const maintenance = assetList.filter((a) => a.status === "Maintenance").length;

  const stats = [
    { label: "Total Assets", value: total, icon: Server, color: "bg-blue-500", light: "bg-blue-50 text-blue-700" },
    { label: "Available", value: available, icon: CheckCircle, color: "bg-green-500", light: "bg-green-50 text-green-700" },
    { label: "Allocated", value: allocated, icon: GitBranch, color: "bg-amber-500", light: "bg-amber-50 text-amber-700" },
    { label: "Maintenance", value: maintenance, icon: AlertCircle, color: "bg-red-500", light: "bg-red-50 text-red-700" },
  ];

  const recentAllocations = allocationList
    .filter((al) => al.allocationStatus === "Allocated")
    .slice(0, 5);

  return (
    <AuthGuard>
      <div className="flex h-full min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8 overflow-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {user?.fullName?.split(" ")[0] || "User"} 👋
            </h1>
            <p className="text-gray-500 text-sm mt-1">Here&apos;s what&apos;s happening with your IT assets.</p>
          </div>

          {loading ? (
            <div className="text-gray-400 text-sm">Loading...</div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                {stats.map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-medium text-gray-500">{label}</span>
                      <div className={`p-2 rounded-lg ${color}`}>
                        <Icon size={18} className="text-white" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-base font-semibold text-gray-900">Active Allocations</h2>
                    <Link href="/allocations" className="text-sm text-blue-600 hover:underline">
                      View all
                    </Link>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {recentAllocations.length === 0 ? (
                      <p className="px-6 py-8 text-sm text-gray-400 text-center">No active allocations</p>
                    ) : (
                      recentAllocations.map((al) => (
                        <div key={al._id} className="px-6 py-4 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {al.asset?.assetName || "Unknown Asset"}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Assigned to {al.user?.fullName || "Unknown"}
                            </p>
                          </div>
                          <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-medium">
                            {al.allocationStatus}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h2 className="text-base font-semibold text-gray-900 mb-4">Quick Actions</h2>
                  <div className="space-y-3">
                    <Link
                      href="/assets/add"
                      className="flex items-center gap-3 w-full p-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-medium transition-colors"
                    >
                      <Plus size={16} />
                      Add New Asset
                    </Link>
                    <Link
                      href="/allocations"
                      className="flex items-center gap-3 w-full p-3 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-medium transition-colors"
                    >
                      <GitBranch size={16} />
                      Manage Allocations
                    </Link>
                    <Link
                      href="/assets"
                      className="flex items-center gap-3 w-full p-3 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-medium transition-colors"
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
