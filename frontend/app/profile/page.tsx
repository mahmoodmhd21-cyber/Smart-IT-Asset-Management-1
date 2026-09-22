"use client";
import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import AuthGuard from "@/components/AuthGuard";
import { auth, getCurrentUser, type User } from "@/lib/api";
import { User as UserIcon, Mail, Shield, Calendar } from "lucide-react";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(getCurrentUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auth.me()
      .then(({ user }) => setUser(user))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const fields = user
    ? [
        { icon: UserIcon, label: "Full Name", value: user.fullName },
        { icon: Mail, label: "Email Address", value: user.email },
        { icon: Shield, label: "Role", value: user.role },
        {
          icon: Calendar,
          label: "Member Since",
          value: user.createdDate
            ? new Date(user.createdDate).toLocaleDateString("en-US", {
                year: "numeric", month: "long", day: "numeric",
              })
            : "—",
        },
      ]
    : [];

  return (
    <AuthGuard>
      <div className="flex h-full min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8 overflow-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
            <p className="text-gray-500 text-sm mt-1">Your account information</p>
          </div>

          <div className="max-w-xl">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-10 flex items-center gap-5">
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-white text-2xl font-bold">
                  {user?.fullName?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div>
                  <h2 className="text-white text-xl font-semibold">{user?.fullName || "—"}</h2>
                  <p className="text-blue-200 text-sm mt-0.5">{user?.email || "—"}</p>
                </div>
              </div>

              <div className="p-6">
                {loading ? (
                  <div className="text-sm text-gray-400 py-4 text-center">Loading profile...</div>
                ) : (
                  <div className="space-y-5">
                    {fields.map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-start gap-4">
                        <div className="p-2 bg-gray-100 rounded-lg flex-shrink-0">
                          <Icon size={18} className="text-gray-500" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
                          <p className="text-sm font-medium text-gray-900 mt-0.5">{value}</p>
                        </div>
                      </div>
                    ))}

                    <div className="pt-2">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          user?.role === "Admin"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {user?.role === "Admin" ? "Administrator" : "IT Staff Member"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
