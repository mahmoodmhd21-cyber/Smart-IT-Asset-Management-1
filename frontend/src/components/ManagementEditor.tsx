import { useEffect, useRef, useState } from "react";
import { Save, X } from "lucide-react";

type Field = { name: string; label: string; type?: string; optional?: boolean; options?: string[] };

export default function ManagementEditor({ title, fields, initial, onSave, onClose }: {
  title: string;
  fields: Field[];
  initial: Record<string, string>;
  onSave: (values: Record<string, string>) => Promise<void>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    // Native modal dialogs provide focus containment, Escape and focus restoration.
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try { await onSave(values); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : "Changes could not be saved."); }
    finally { setSaving(false); }
  }
  return <dialog ref={dialog} aria-labelledby="management-title" onCancel={event => { event.preventDefault(); if (!saving) onClose(); }} className="m-auto w-[min(560px,calc(100%-32px))] max-h-[90vh] overflow-auto rounded-lg p-6 backdrop:bg-black/40">
    <div className="mb-5 flex items-center justify-between gap-3">
      <h2 id="management-title" className="text-lg font-semibold">{title}</h2>
      <button type="button" onClick={onClose} disabled={saving} aria-label="Close editor" title="Close editor"><X size={20} /></button>
    </div>
    <form onSubmit={submit}>
      <fieldset disabled={saving} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map(field => <label key={field.name} className="text-sm font-medium">
          {field.label}
          {field.options ? <select className="mt-1 w-full rounded border border-gray-300 p-2" value={values[field.name]} onChange={e => setValues({ ...values, [field.name]: e.target.value })}>
            {field.options.map(option => <option key={option}>{option}</option>)}
          </select> : <input className="mt-1 w-full rounded border border-gray-300 p-2" type={field.type || "text"} required={!field.optional} value={values[field.name] || ""} onChange={e => setValues({ ...values, [field.name]: e.target.value })} />}
        </label>)}
      </fieldset>
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      <div className="mt-5 flex gap-3">
        <button disabled={saving} className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-white"><Save size={16} />{saving ? "Saving..." : "Save changes"}</button>
        <button type="button" disabled={saving} onClick={onClose} className="rounded border px-4 py-2">Cancel</button>
      </div>
    </form>
  </dialog>;
}
