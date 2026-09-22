import { Navigate } from "react-router-dom";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  if (!localStorage.getItem("authToken")) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
