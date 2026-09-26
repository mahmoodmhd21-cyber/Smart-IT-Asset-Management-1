import { RefreshCw } from "lucide-react";

export default function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
    <span>{message}</span>
    <button type="button" onClick={retry} className="inline-flex items-center gap-2 rounded border border-red-300 px-3 py-1"><RefreshCw size={16} />Retry</button>
  </div>;
}
