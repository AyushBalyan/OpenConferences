'use client';

import { FileSpreadsheet, Upload, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isOutreachSpreadsheet, OUTREACH_FILE_MAX_BYTES } from '@/lib/outreach-spreadsheet';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SpreadsheetUploadField({
  file,
  onFileChange,
  disabled = false,
}: {
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  function applyFile(next: File | null) {
    if (!next) {
      setValidationError(null);
      onFileChange(null);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    if (!isOutreachSpreadsheet(next)) {
      setValidationError('Upload a CSV or Excel (.xlsx) file.');
      onFileChange(null);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    if (next.size > OUTREACH_FILE_MAX_BYTES) {
      setValidationError(
        `File is too large. Maximum size is ${formatFileSize(OUTREACH_FILE_MAX_BYTES)}.`,
      );
      onFileChange(null);
      return;
    }
    setValidationError(null);
    onFileChange(next);
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => applyFile(event.target.files?.[0] ?? null)}
      />
      {file ? (
        <div className="flex items-start gap-3 rounded-lg border border-indigo-200 bg-indigo-50/50 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-indigo-100">
            <FileSpreadsheet className="h-5 w-5 text-indigo-600" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
            <p className="mt-0.5 text-xs text-slate-500">{formatFileSize(file.size)}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 px-2 text-slate-500 hover:text-slate-900"
            disabled={disabled}
            onClick={() => applyFile(null)}
            aria-label="Remove selected file"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          onClick={() => {
            if (!disabled) inputRef.current?.click();
          }}
          onKeyDown={(event) => {
            if (disabled) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragEnter={(event) => {
            event.preventDefault();
            if (!disabled) setDragActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) setDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            if (event.currentTarget.contains(event.relatedTarget as Node)) return;
            setDragActive(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            if (!disabled) applyFile(event.dataTransfer.files[0] ?? null);
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-10 text-center transition-colors',
            disabled && 'cursor-not-allowed opacity-60',
            dragActive
              ? 'border-indigo-400 bg-indigo-50/80'
              : 'border-slate-200 bg-slate-50/50 hover:border-indigo-300 hover:bg-indigo-50/40',
          )}
        >
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-500 ring-1 ring-slate-200">
            <Upload className="h-5 w-5" aria-hidden />
          </div>
          <p className="text-sm font-medium text-slate-900">Drop a CSV or Excel file, or browse</p>
          <p className="mt-1 text-xs text-slate-500">
            Columns: name, email, topic, paper · up to 500 rows
          </p>
        </div>
      )}
      {validationError ? (
        <p className="text-sm text-rose-600" role="alert">
          {validationError}
        </p>
      ) : null}
    </div>
  );
}
