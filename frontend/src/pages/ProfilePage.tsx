import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import AuthGuard from "../components/AuthGuard";
import { auth, getCurrentUser, type User } from "../lib/api";
import { User as UserIcon, Mail, Shield, Calendar } from "lucide-react";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(getCurrentUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auth
      .me()
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
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            : "—",
        },
      ]
    : [];

  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8 overflow-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold" style={{ color: "#111827" }}>
              My Profile
            </h1>
            <p className="text-sm mt-1" style={{ color: "#6b7280" }}>
              Your account information
            </p>
          </div>

          <div className="max-w-xl">
            <div
              className="rounded-xl overflow-hidden"
              style={{ backgroundColor: "white", border: "1px solid #f3f4f6", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
            >
              <div
                className="px-8 py-10 flex items-center gap-5"
                style={{ background: "linear-gradient(90deg, #2563eb 0%, #1d4ed8 100%)" }}
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold"
                  style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
                >
                  {user?.fullName?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div>
                  <h2 className="text-white text-xl font-semibold">
                    {user?.fullName || "—"}
                  </h2>
                  <p className="text-sm mt-0.5" style={{ color: "#bfdbfe" }}>
                    {user?.email || "—"}
                  </p>
                </div>
              </div>

              <div className="p-6">
                {loading ? (
                  <div className="text-sm py-4 text-center" style={{ color: "#9ca3af" }}>
                    Loading profile...
                  </div>
                ) : (
                  <div className="space-y-5">
                    {fields.map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-start gap-4">
                        <div className="p-2 rounded-lg flex-shrink-0" style={{ backgroundColor: "#f3f4f6" }}>
                          <Icon size={18} color="#6b7280" />
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "#6b7280" }}>
                            {label}
                          </p>
                          <p className="text-sm font-medium mt-0.5" style={{ color: "#111827" }}>
                            {value}
                          </p>
                        </div>
                      </div>
                    ))}

                    <div className="pt-2">
                      <span
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: user?.role === "Admin" ? "#f3e8ff" : "#eff6ff",
                          color: user?.role === "Admin" ? "#7e22ce" : "#1d4ed8",
                        }}
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
