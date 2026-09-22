import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Download,
  QrCode,
  RefreshCw,
  ScanLine,
  Square,
} from "lucide-react";
import AuthGuard from "../components/AuthGuard";
import Sidebar from "../components/Sidebar";
import {
  assets,
  qrCodes,
  type Asset,
  type AssetQRCode,
} from "../lib/api";

type ScannerInstance = InstanceType<
  (typeof import("html5-qrcode"))["Html5Qrcode"]
>;

const STATUSES: Asset["status"][] = [
  "Available",
  "Allocated",
  "Maintenance",
  "Retired",
];

const STATUS_STYLES: Record<Asset["status"], { bg: string; color: string }> = {
  Available: { bg: "#dcfce7", color: "#166534" },
  Allocated: { bg: "#fef3c7", color: "#92400e" },
  Maintenance: { bg: "#fee2e2", color: "#991b1b" },
  Retired: { bg: "#e5e7eb", color: "#4b5563" },
};

export default function QRCodePage() {
  const [assetList, setAssetList] = useState<Asset[]>([]);
  const [records, setRecords] = useState<AssetQRCode[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<AssetQRCode | null>(null);
  const [scannedRecord, setScannedRecord] = useState<AssetQRCode | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [nextStatus, setNextStatus] = useState<Asset["status"]>("Available");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const scannerRef = useRef<ScannerInstance | null>(null);

  const recordByAsset = useMemo(
    () => new Map(records.map((record) => [record.asset._id, record])),
    [records]
  );

  useEffect(() => {
    Promise.all([assets.list(), qrCodes.list()])
      .then(([allAssets, allRecords]) => {
        setAssetList(allAssets);
        setRecords(allRecords);
        if (allAssets.length > 0) setSelectedAssetId(allAssets[0]._id);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setSelectedRecord(recordByAsset.get(selectedAssetId) || null);
  }, [recordByAsset, selectedAssetId]);

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      if (!scanner) return;
      void scanner.stop().catch(() => undefined).finally(() => {
        try {
          scanner.clear();
        } catch {
          // The scanner may already have cleared itself after decoding.
        }
      });
    };
  }, []);

  function showError(err: unknown, fallback: string) {
    setNotice("");
    setError(err instanceof Error ? err.message : fallback);
  }

  function upsertRecord(record: AssetQRCode) {
    setRecords((current) => {
      const exists = current.some((item) => item.asset._id === record.asset._id);
      return exists
        ? current.map((item) => (item.asset._id === record.asset._id ? record : item))
        : [record, ...current];
    });
  }

  async function handleGenerate(regenerate = false) {
    if (!selectedAssetId) return;
    if (
      regenerate &&
      !confirm("Regenerate this QR code? Previously printed labels will stop working.")
    ) {
      return;
    }

    setGenerating(true);
    setError("");
    setNotice("");
    try {
      const record = await qrCodes.generate(selectedAssetId, regenerate);
      upsertRecord(record);
      setSelectedRecord(record);
      setNotice(regenerate ? "QR code regenerated." : "QR code is ready.");
    } catch (err) {
      showError(err, "Could not generate the QR code");
    } finally {
      setGenerating(false);
    }
  }

  async function stopCamera() {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setScanning(false);
    if (!scanner) return;

    try {
      await scanner.stop();
    } catch {
      // Stopping an already stopped camera is harmless.
    }
    try {
      scanner.clear();
    } catch {
      // The scanner container may already be empty.
    }
  }

  async function handleLookup(code = manualCode) {
    if (!code.trim()) {
      setError("Scan a QR code or enter its value first.");
      return;
    }

    setLookingUp(true);
    setError("");
    setNotice("");
    try {
      const record = await qrCodes.scan(code.trim());
      setManualCode(code.trim());
      setScannedRecord(record);
      setNextStatus(record.asset.status);
      upsertRecord(record);
    } catch (err) {
      setScannedRecord(null);
      showError(err, "QR code lookup failed");
    } finally {
      setLookingUp(false);
    }
  }

  async function startCamera() {
    setError("");
    setNotice("");
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      setScanning(true);

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 230, height: 230 } },
        (decodedText) => {
          void stopCamera().then(() => handleLookup(decodedText));
        },
        () => undefined
      );
    } catch (err) {
      await stopCamera();
      showError(err, "Camera access could not be started");
    }
  }

  async function handleStatusUpdate() {
    if (!scannedRecord) return;
    setUpdating(true);
    setError("");
    setNotice("");
    try {
      const record = await qrCodes.updateStatus(scannedRecord.token, nextStatus);
      setScannedRecord(record);
      upsertRecord(record);
      setAssetList((current) =>
        current.map((asset) => (asset._id === record.asset._id ? record.asset : asset))
      );
      setNotice("Asset status updated.");
    } catch (err) {
      showError(err, "Could not update the asset status");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">QR Code Management</h1>
            <p className="mt-1 text-sm text-gray-500">
              {records.length} of {assetList.length} assets have generated QR codes
            </p>
          </div>

          {(error || notice) && (
            <div
              className="mb-5 rounded-lg border px-4 py-3 text-sm"
              style={
                error
                  ? { backgroundColor: "#fef2f2", borderColor: "#fecaca", color: "#b91c1c" }
                  : { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" }
              }
            >
              {error || notice}
            </div>
          )}

          <div className="grid gap-5 xl:grid-cols-2">
            <section className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                  <QrCode size={20} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Generate asset label</h2>
                  <p className="text-sm text-gray-500">Create and download a printable QR code</p>
                </div>
              </div>

              <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="qr-asset">
                Asset
              </label>
              <select
                id="qr-asset"
                value={selectedAssetId}
                onChange={(event) => setSelectedAssetId(event.target.value)}
                disabled={loading || assetList.length === 0}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              >
                {assetList.length === 0 && <option value="">No assets available</option>}
                {assetList.map((asset) => (
                  <option key={asset._id} value={asset._id}>
                    {asset.assetName} · {[asset.brand, asset.model].filter(Boolean).join(" ") || "No model"}
                  </option>
                ))}
              </select>

              <div className="mt-5 flex min-h-[300px] items-center justify-center border-y border-gray-100 py-5">
                {selectedRecord ? (
                  <img
                    src={selectedRecord.imageDataUrl || selectedRecord.imageUrl}
                    alt={`QR code for ${selectedRecord.asset.assetName}`}
                    className="h-64 w-64 object-contain"
                  />
                ) : (
                  <div className="text-center text-gray-400">
                    <QrCode className="mx-auto mb-3" size={54} strokeWidth={1.25} />
                    <p className="text-sm">No QR code generated for this asset</p>
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {!selectedRecord ? (
                  <button
                    onClick={() => handleGenerate(false)}
                    disabled={!selectedAssetId || generating}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    <QrCode size={16} />
                    {generating ? "Generating..." : "Generate QR"}
                  </button>
                ) : (
                  <>
                    <a
                      href={`${selectedRecord.imageUrl}?download=1`}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                    >
                      <Download size={16} />
                      Download PNG
                    </a>
                    <button
                      onClick={() => handleGenerate(true)}
                      disabled={generating}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50"
                    >
                      <RefreshCw size={16} />
                      Regenerate
                    </button>
                  </>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                  <ScanLine size={20} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Scan and identify</h2>
                  <p className="text-sm text-gray-500">Retrieve the linked asset and manage its status</p>
                </div>
              </div>

              <div
                id="qr-reader"
                className="flex min-h-[280px] items-center justify-center overflow-hidden bg-gray-950 text-white"
                style={{ aspectRatio: "16 / 9", borderRadius: "8px" }}
              >
                {!scanning && (
                  <div className="text-center text-gray-400">
                    <Camera className="mx-auto mb-3" size={42} strokeWidth={1.4} />
                    <p className="text-sm">Camera is off</p>
                  </div>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                {!scanning ? (
                  <button
                    onClick={startCamera}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
                  >
                    <Camera size={16} />
                    Start camera
                  </button>
                ) : (
                  <button
                    onClick={stopCamera}
                    className="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white"
                  >
                    <Square size={15} />
                    Stop camera
                  </button>
                )}
              </div>

              <div className="my-4 flex items-center gap-3 text-xs uppercase text-gray-400">
                <span className="h-px flex-1 bg-gray-200" />
                Manual lookup
                <span className="h-px flex-1 bg-gray-200" />
              </div>

              <div className="flex gap-2">
                <input
                  value={manualCode}
                  onChange={(event) => setManualCode(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void handleLookup();
                  }}
                  placeholder="Paste a QR URL or token"
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => handleLookup()}
                  disabled={lookingUp}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50"
                >
                  {lookingUp ? "Looking up..." : "Retrieve"}
                </button>
              </div>

              {scannedRecord && (
                <div className="mt-5 border-t border-gray-200 pt-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase text-gray-400">Identified asset</p>
                      <h3 className="mt-1 text-lg font-semibold text-gray-900">
                        {scannedRecord.asset.assetName}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {[scannedRecord.asset.brand, scannedRecord.asset.model]
                          .filter(Boolean)
                          .join(" · ") || "No brand or model"}
                      </p>
                    </div>
                    <CheckCircle2 className="text-emerald-600" size={22} />
                  </div>

                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div>
                      <dt className="text-gray-400">Category</dt>
                      <dd className="font-medium text-gray-700">{scannedRecord.asset.category || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-400">Location</dt>
                      <dd className="font-medium text-gray-700">{scannedRecord.asset.location || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-400">Scans</dt>
                      <dd className="font-medium text-gray-700">{scannedRecord.scanCount}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-400">Current status</dt>
                      <dd>
                        <span
                          className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                          style={STATUS_STYLES[scannedRecord.asset.status]}
                        >
                          {scannedRecord.asset.status}
                        </span>
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-5 flex gap-2 border-t border-gray-100 pt-4">
                    <select
                      value={nextStatus}
                      onChange={(event) => setNextStatus(event.target.value as Asset["status"])}
                      className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                    >
                      {STATUSES.map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleStatusUpdate}
                      disabled={updating || nextStatus === scannedRecord.asset.status}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {updating ? "Updating..." : "Update status"}
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>

          <section className="mt-5 overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Generated codes</h2>
                <p className="text-sm text-gray-500">Scan activity for registered asset labels</p>
              </div>
            </div>

            {loading ? (
              <div className="p-10 text-center text-sm text-gray-400">Loading QR records...</div>
            ) : records.length === 0 ? (
              <div className="p-10 text-center text-sm text-gray-400">No QR codes generated yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-500">
                      <th className="px-5 py-3 font-medium">Asset</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Generated</th>
                      <th className="px-5 py-3 font-medium">Scans</th>
                      <th className="px-5 py-3 font-medium">Last scanned</th>
                      <th className="px-5 py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => (
                      <tr key={record._id} className="border-b border-gray-50">
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-gray-900">{record.asset.assetName}</p>
                          <p className="text-xs text-gray-400">
                            {[record.asset.brand, record.asset.model].filter(Boolean).join(" ") || "No model"}
                          </p>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                            style={STATUS_STYLES[record.asset.status]}
                          >
                            {record.asset.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-gray-500">
                          {new Date(record.generatedAt).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-gray-700">{record.scanCount}</td>
                        <td className="px-5 py-3.5 text-gray-500">
                          {record.lastScannedAt
                            ? new Date(record.lastScannedAt).toLocaleString()
                            : "Never"}
                        </td>
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => {
                              setSelectedAssetId(record.asset._id);
                              setSelectedRecord(record);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600"
                          >
                            <QrCode size={15} />
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
