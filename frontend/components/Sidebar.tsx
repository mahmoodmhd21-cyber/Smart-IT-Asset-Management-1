"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout, getCurrentUser } from "@/lib/api";
import {
  LayoutDashboard,
  Server,
  GitBranch,
  User,
  LogOut,
  Monitor,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assets", label: "Assets", icon: Server },
  { href: "/allocations", label: "Allocations", icon: GitBranch },
  { href: "/profile", label: "Profile", icon: User },
];

export default function Sidebar() {
  const pathname = usePathname();
  const user = getCurrentUser();

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col min-h-screen">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700">
        <div className="p-2 bg-blue-600 rounded-lg">
          <Monitor size={20} />
        </div>
        <div>
          <p className="font-semibold text-sm leading-tight">IT Asset</p>
          <p className="text-xs text-slate-400">Management</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-slate-700">
        <div className="px-3 py-2 mb-2">
          <p className="text-sm font-medium text-white truncate">
            {user?.fullName || "User"}
          </p>
          <p className="text-xs text-slate-400 truncate">{user?.role || ""}</p>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
