import { useSyncExternalStore } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getCurrentUser } from "../lib/api";
import { sessionToken, subscribeSession } from "../lib/session";

export default function AuthGuard({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const token = useSyncExternalStore(subscribeSession, sessionToken);
  const location = useLocation();
  if (!token) {
    return <Navigate to="/" replace state={{ from: location.pathname + location.search }} />;
  }
  // Presentation guard only; every privileged API independently checks the current role.
  if (adminOnly && getCurrentUser()?.role !== "Admin") return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
