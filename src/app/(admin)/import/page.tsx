'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { SUPPORTED_IMPORT_TYPES } from '@/lib/csv/parsers';

type ImportResult = {
  success: boolean;
  total: number;
  upserted: number;
  skipped: number;
  errors: string[];
};

export default function ImportPage() {
  const [importType, setImportType] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.name.endsWith('.csv')) {
      setFile(dropped);
      setResult(null);
    } else {
      toast.error('Please drop a CSV file');
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (picked) {
      setFile(picked);
      setResult(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !importType) return;

    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('importType', importType);

      const res = await fetch('/api/import', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? 'Import failed');
        return;
      }

      setResult(data);
      toast.success(`${data.upserted} contacts imported`);
    } catch {
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = importType && file && !loading;

  return (
    <div className="px-4 py-6 lg:px-8 lg:py-8 max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Import Data</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Upload a CSV exported from Instabook Reports. Contacts are upserted by email — re-importing
          the same report is safe.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Report type */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="importType" className="text-sm font-medium text-zinc-700">
            Report type
          </label>
          <select
            id="importType"
            value={importType}
            onChange={(e) => setImportType(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
          >
            <option value="">Select a report type…</option>
            {SUPPORTED_IMPORT_TYPES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <p className="text-xs text-zinc-400">
            Match this to the report you exported from Instabook &rarr; Reports
          </p>
        </div>

        {/* File upload */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">CSV file</label>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 cursor-pointer transition-colors ${
              dragging
                ? 'border-zinc-900 bg-zinc-100'
                : 'border-zinc-300 bg-white hover:border-zinc-400 hover:bg-zinc-50'
            }`}
          >
            {file ? (
              <>
                <span className="text-sm font-medium text-zinc-900">{file.name}</span>
                <span className="text-xs text-zinc-400">
                  {(file.size / 1024).toFixed(1)} KB &middot; click to change
                </span>
              </>
            ) : (
              <>
                <span className="text-sm text-zinc-600">Drop a CSV file here, or click to browse</span>
                <span className="text-xs text-zinc-400">.csv files only</span>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Submit */}
        <div>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-md bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Importing…' : 'Import'}
          </button>
        </div>
      </form>

      {/* Results */}
      {result && (
        <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-zinc-900 mb-4">Import complete</h2>
          <dl className="grid grid-cols-3 gap-4">
            <div>
              <dt className="text-xs text-zinc-500">Rows in file</dt>
              <dd className="mt-1 text-2xl font-bold text-zinc-900">{result.total}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Contacts upserted</dt>
              <dd className="mt-1 text-2xl font-bold text-zinc-900">{result.upserted}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Skipped (no email)</dt>
              <dd className="mt-1 text-2xl font-bold text-zinc-900">{result.skipped}</dd>
            </div>
          </dl>

          {result.errors.length > 0 && (
            <div className="mt-4 rounded-md bg-red-50 border border-red-200 p-3">
              <p className="text-xs font-medium text-red-700 mb-1">
                {result.errors.length} row{result.errors.length > 1 ? 's' : ''} failed:
              </p>
              <ul className="text-xs text-red-600 space-y-0.5 list-disc list-inside">
                {result.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
