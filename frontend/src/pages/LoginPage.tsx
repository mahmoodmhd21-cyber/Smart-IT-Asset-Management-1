import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../lib/api";
import { Monitor } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token, user } = await auth.login(form.email, form.password);
      localStorage.setItem("authToken", token);
      localStorage.setItem("currentUser", JSON.stringify(user));
      navigate("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 16px",
    fontSize: "0.875rem",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    outline: "none",
    boxSizing: "border-box",
    backgroundColor: "white",
    color: "#111827",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      }}
    >
      <div style={{ width: "100%", maxWidth: "420px" }}>
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              padding: "12px",
              backgroundColor: "#2563eb",
              borderRadius: "12px",
            }}
          >
            <Monitor size={28} color="white" />
          </div>
          <div>
            <h1 style={{ color: "white", fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
              Smart IT Asset
            </h1>
            <p style={{ color: "#94a3b8", fontSize: "0.875rem", margin: 0 }}>
              Management System
            </p>
          </div>
        </div>

        {/* Card */}
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "16px",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.4)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "24px 32px 0",
              borderBottom: "1px solid #e5e7eb",
              paddingBottom: "20px",
            }}
          >
            <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: "#111827" }}>
              Sign In
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "0.875rem", color: "#6b7280" }}>
              Enter your credentials to access the system
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ padding: "28px 32px 32px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "#374151",
                    marginBottom: "6px",
                  }}
                >
                  Email Address
                </label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@company.com"
                  required
                  style={fieldStyle}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "#374151",
                    marginBottom: "6px",
                  }}
                >
                  Password
                </label>
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  style={fieldStyle}
                />
              </div>

              {error && (
                <div
                  style={{
                    padding: "12px",
                    backgroundColor: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: "8px",
                    color: "#dc2626",
                    fontSize: "0.875rem",
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "12px",
                  backgroundColor: loading ? "#93c5fd" : "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                  marginTop: "4px",
                }}
              >
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </div>
          </form>
        </div>

        <p
          style={{
            textAlign: "center",
            marginTop: "20px",
            fontSize: "0.8125rem",
            color: "#64748b",
          }}
        >
          Contact your administrator to get access.
        </p>
      </div>
    </div>
  );
}
