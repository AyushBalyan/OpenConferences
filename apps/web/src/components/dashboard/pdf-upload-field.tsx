'use client';

import { FileText, Upload, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const DEFAULT_PDF_MAX_BYTES = 52_428_800;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

export function PdfUploadField({
  file,
  onFileChange,
  disabled = false,
  maxBytes = DEFAULT_PDF_MAX_BYTES,
  className,
}: {
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
  maxBytes?: number;
  className?: string;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  function validate(next: File): string | null {
    if (!isPdfFile(next)) {
      return 'Only PDF files are accepted.';
    }
    if (next.size > maxBytes) {
      return `File is too large (${formatFileSize(next.size)}). Maximum size is ${formatFileSize(maxBytes)}.`;
    }
    if (next.size === 0) {
      return 'The selected file is empty.';
    }
    return null;
  }

  function applyFile(next: File | null) {
    if (!next) {
      setValidationError(null);
      onFileChange(null);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    const error = validate(next);
    setValidationError(error);
    onFileChange(error ? null : next);
    if (error && inputRef.current) inputRef.current.value = '';
  }

  function onInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    applyFile(event.target.files?.[0] ?? null);
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    if (disabled) return;
    applyFile(event.dataTransfer.files[0] ?? null);
  }

  return (
    <div className={cn('min-w-0 max-w-full space-y-2', className)}>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        disabled={disabled}
        onChange={onInputChange}
      />

      {file ? (
        <div className="flex items-start gap-3 rounded-lg border border-indigo-200 bg-indigo-50/50 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-indigo-100">
            <FileText className="h-5 w-5 text-indigo-600" aria-hidden />
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
            aria-label="Remove selected PDF"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          aria-labelledby={`${inputId}-label`}
          aria-describedby={`${inputId}-hint`}
          onKeyDown={(event) => {
            if (disabled) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onClick={() => {
            if (!disabled) inputRef.current?.click();
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
          onDrop={onDrop}
          className={cn(
            'flex min-w-0 max-w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed px-4 py-10 text-center transition-colors sm:px-6',
            disabled && 'cursor-not-allowed opacity-60',
            dragActive
              ? 'border-indigo-400 bg-indigo-50/80'
              : 'border-slate-200 bg-slate-50/50 hover:border-indigo-300 hover:bg-indigo-50/40',
          )}
        >
          <div
            className={cn(
              'mb-3 flex h-11 w-11 items-center justify-center rounded-full transition-colors',
              dragActive
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-white text-slate-500 ring-1 ring-slate-200',
            )}
          >
            <Upload className="h-5 w-5" aria-hidden />
          </div>
          <p
            id={`${inputId}-label`}
            className="max-w-full break-words text-sm font-medium text-slate-900"
          >
            {dragActive ? 'Drop PDF to upload' : 'Drop your PDF here, or browse'}
          </p>
          <p
            id={`${inputId}-hint`}
            className={cn('mt-1 text-xs', dragActive ? 'text-indigo-700/80' : 'text-slate-500')}
          >
            PDF only · up to {formatFileSize(maxBytes)}
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

export type UploadProgressStep = 'uploading' | 'scanning' | 'submitting';

const UPLOAD_STEP_LABELS: Record<UploadProgressStep, string> = {
  uploading: 'Uploading PDF',
  scanning: 'Scanning for security',
  submitting: 'Submitting paper',
};

export function UploadProgressSteps({ current }: { current: UploadProgressStep }) {
  const steps: UploadProgressStep[] = ['uploading', 'scanning', 'submitting'];
  const currentIndex = steps.indexOf(current);

  return (
    <ol
      className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 p-4"
      aria-live="polite"
    >
      {steps.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;

        return (
          <li key={step} className="flex items-center gap-3 text-sm">
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                done && 'bg-emerald-100 text-emerald-700',
                active && 'bg-indigo-600 text-white',
                !done && !active && 'bg-slate-200 text-slate-500',
              )}
              aria-hidden
            >
              {done ? '✓' : index + 1}
            </span>
            <span
              className={cn(
                done && 'text-slate-600',
                active && 'font-medium text-slate-900',
                !done && !active && 'text-slate-400',
              )}
            >
              {UPLOAD_STEP_LABELS[step]}
              {active ? '…' : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
