import { useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import {
  AlertCircle,
  FileSpreadsheet,
  FileText,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import type { UploadedFileMeta } from '../types/pii';
import { formatFileSize } from '../utils/formatters';

interface InputWorkspaceProps {
  inputText: string;
  fileMeta: UploadedFileMeta | null;
  errorMessage: string | null;
  onTextChange: (text: string) => void;
  onFileSelected: (file: File) => void;
  onLoadSample: () => void;
  onClear: () => void;
  onValidateInput: () => void;
}

export function InputWorkspace({
  inputText,
  fileMeta,
  errorMessage,
  onTextChange,
  onFileSelected,
  onLoadSample,
  onClear,
  onValidateInput,
}: InputWorkspaceProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      onFileSelected(droppedFile);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
    }
    // Reset so re-uploading the same filename works
    e.target.value = '';
  };

  const charCount = inputText.length;

  return (
    <section
      aria-labelledby="input-workspace-heading"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="input-workspace-heading"
            className="text-base font-semibold text-slate-900"
          >
            Input Document
          </h2>
          <p className="text-xs text-slate-500">
            Paste raw text or upload a .txt / .csv file. Everything stays in memory.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onLoadSample}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Load Sample Data
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            Upload TXT / CSV
          </button>

          <button
            type="button"
            onClick={onValidateInput}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-800"
          >
            Scan Input
          </button>

          <button
            type="button"
            onClick={onClear}
            disabled={!inputText && !fileMeta && !errorMessage}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Clear
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.csv,text/plain,text/csv"
        onChange={handleFileChange}
        aria-label="Upload TXT or CSV file"
        className="sr-only"
      />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-lg border transition-colors focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/25 ${
          isDragging
            ? 'border-blue-500 bg-blue-50/60'
            : 'border-slate-200 bg-slate-50/50'
        }`}
      >
        <label htmlFor="pii-input-textarea" className="sr-only">
          Source text or CSV content to scan for PII
        </label>
        <textarea
          id="pii-input-textarea"
          value={inputText}
          onChange={(e) => onTextChange(e.target.value)}
          rows={6}
          placeholder="Paste logs, customer notes, or CSV rows here — or drag and drop a .txt / .csv file..."
          className="block w-full resize-y rounded-lg bg-transparent p-3.5 font-mono text-sm leading-relaxed text-slate-800 placeholder:font-sans placeholder:text-slate-500 focus:outline-none"
        />

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 px-3.5 py-2 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              <strong className="font-medium text-slate-800">
                {charCount.toLocaleString()}
              </strong>{' '}
              characters
            </span>

            {fileMeta && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-slate-700">
                {fileMeta.type === 'csv' ? (
                  <FileSpreadsheet className="h-3.5 w-3.5 text-teal-600" aria-hidden="true" />
                ) : (
                  <FileText className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                )}
                <span className="font-medium">{fileMeta.name}</span>
                <span className="text-slate-500">·</span>
                <span>{formatFileSize(fileMeta.size)}</span>
              </span>
            )}
          </div>

          <span className="text-slate-600">
            Supported formats: TXT, CSV (max 5 MB)
          </span>
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}
    </section>
  );
}
