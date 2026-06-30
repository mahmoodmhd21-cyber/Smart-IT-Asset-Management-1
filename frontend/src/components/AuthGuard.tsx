import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) {
      navigate("/", { replace: true });
    } else {
      setReady(true);
    }
  }, [navigate]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}
