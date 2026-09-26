import { Component, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import AuthGuard from "./AuthGuard";
import { Sidebar } from "./Sidebar";

// Keep navigation available when the QR route has an unexpected render failure.
export default class QRCodeBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <AuthGuard><div className="flex min-h-screen"><Sidebar />
      <main className="min-w-0 flex-1 p-8">
        <h1 className="text-2xl font-bold">QR Code Management</h1>
        <p role="alert" className="my-4 text-red-700">QR Code Management could not be displayed.</p>
        <button onClick={() => this.setState({ failed: false })} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white"><RefreshCw size={16} />Try again</button>
      </main>
    </div></AuthGuard>;
  }
}
