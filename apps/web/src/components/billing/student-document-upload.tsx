'use client';

import { CheckCircle2, FileText, Loader2, Upload, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import type { RegistrationDetailDto } from '@openconferences/schemas';
import { completeStudentDocUpload, initiateStudentDocUpload } from '@/lib/api-client';
import { Button } from '@/components/ui/button';

const MAX_DOCUMENT_BYTES = 10_485_760;
const DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

function contentType(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase();
  return extension === 'pdf'
    ? 'application/pdf'
    : extension === 'png'
      ? 'image/png'
      : extension === 'jpg' || extension === 'jpeg'
        ? 'image/jpeg'
        : '';
}

export function StudentDocumentUpload({
  conferenceId,
  paperId,
  verification,
  disabled,
  onUploaded,
  onBusyChange,
}: {
  conferenceId: string;
  paperId: string;
  verification: RegistrationDetailDto['latestVerification'];
  disabled: boolean;
  onUploaded: () => Promise<void>;
  onBusyChange: (busy: boolean) => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);
  const busy = disabled || uploading;
  const received = Boolean(verification || uploadedFilename);

  function selectFile(next: File | null) {
    if (busy) return;
    setError(null);
    setFile(null);
    if (inputRef.current) inputRef.current.value = '';
    if (!next) {
      setFile(null);
      return;
    }
    if (!DOCUMENT_TYPES.includes(contentType(next))) {
      setError('Choose a PDF, JPEG, or PNG file.');
      return;
    }
    if (next.size === 0) {
      setError('This file is empty. Choose a different document.');
      return;
    }
    if (next.size > MAX_DOCUMENT_BYTES) {
      setError('This file is too large. Choose a document under 10 MB.');
      return;
    }
    setFile(next);
  }

  async function upload() {
    if (!file || busy) return;
    setUploading(true);
    onBusyChange(true);
    setError(null);
    try {
      const mimeType = contentType(file);
      const presigned = await initiateStudentDocUpload(conferenceId, paperId, {
        originalFilename: file.name,
        contentType: mimeType,
        sizeBytes: file.size,
      });
      const result = await fetch(presigned.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': mimeType },
        body: file,
      });
      if (!result.ok) throw new Error('Your document could not be uploaded. Please try again.');
      await completeStudentDocUpload(conferenceId, paperId, { objectKey: presigned.objectKey });
      setUploadedFilename(file.name);
      setFile(null);
      await onUploaded();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Your document could not be uploaded. Please try again.',
      );
    } finally {
      setUploading(false);
      onBusyChange(false);
    }
  }

  return (
    <section
      aria-labelledby={`${inputId}-title`}
      className="space-y-4 border-t border-slate-200 pt-5"
    >
      <div className="space-y-1">
        <h3 id={`${inputId}-title`} className="text-base font-medium text-slate-900">
          Student status proof
        </h3>
        <p className="text-sm leading-relaxed text-slate-600">
          {received
            ? 'Your proof of student status is on file.'
            : 'Upload one document showing your name, institution, and current enrollment before making payment.'}
        </p>
      </div>
      {received ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
        >
          {verification?.status === 'REJECTED' ||
          verification?.status === 'CLARIFICATION_REQUESTED' ? (
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden />
          ) : (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
          )}
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-slate-900">
              {verification?.status === 'APPROVED'
                ? 'Student status confirmed'
                : verification?.status === 'REJECTED'
                  ? 'Document not approved'
                  : verification?.status === 'CLARIFICATION_REQUESTED'
                    ? 'More information requested'
                    : 'Document received'}
            </p>
            {uploadedFilename ? (
              <p className="break-words text-sm text-slate-700">{uploadedFilename}</p>
            ) : null}
            <p className="text-sm leading-relaxed text-slate-600">
              {verification?.note ||
                (verification?.status === 'PENDING' || !verification
                  ? 'Awaiting organizer review. You can continue to payment.'
                  : verification?.status === 'APPROVED'
                    ? 'Your proof of enrollment has been approved.'
                    : 'Contact the organizers for the next steps.')}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-2 text-sm text-slate-600">
            <h4 className="font-medium text-slate-900">Acceptable documents</h4>
            <ul className="list-disc space-y-1 pl-4 leading-relaxed">
              <li>A current student ID showing your enrollment period</li>
              <li>An enrollment or bonafide certificate from your institution</li>
              <li>An official letter confirming your current student status</li>
            </ul>
            <p className="text-xs leading-relaxed">
              Upload a clear, readable copy. Final approval is by the conference organizers.
            </p>
          </div>
          <input
            id={inputId}
            ref={inputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
            className="sr-only"
            aria-label="Choose student proof document"
            disabled={busy}
            onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
          />
          {file ? (
            <div className="flex items-start gap-3 rounded-lg border border-slate-200 p-4">
              <FileText className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium text-slate-900">{file.name}</p>
                <p className="mt-1 text-xs text-slate-600">
                  {file.size < 1024 * 1024
                    ? `${Math.ceil(file.size / 1024)} KB`
                    : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}{' '}
                  · Ready to upload
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label="Remove selected document"
                disabled={busy}
                onClick={() => selectFile(null)}
                className="h-8 shrink-0 px-2"
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                if (!busy) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                selectFile(event.dataTransfer.files[0] ?? null);
              }}
              aria-describedby={`${inputId}-formats`}
              className={`flex w-full flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60 ${dragging ? 'border-slate-500 bg-slate-100' : 'border-slate-300 bg-slate-50/60 hover:border-slate-500 hover:bg-slate-50'}`}
            >
              <Upload className="mb-1 h-5 w-5 text-slate-500" aria-hidden />
              <span className="text-sm font-medium text-slate-900">
                {dragging ? 'Drop your document here' : 'Drop your document here, or browse'}
              </span>
              <span id={`${inputId}-formats`} className="text-xs text-slate-600">
                PDF, JPEG, or PNG · up to 10 MB
              </span>
            </button>
          )}
          {error ? (
            <p role="alert" className="text-sm text-rose-800">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={busy || !file}
              aria-busy={uploading}
              onClick={() => void upload()}
              variant="outline"
              className="shadow-none"
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" aria-hidden />
              ) : null}
              {uploading ? 'Uploading document…' : 'Upload student proof'}
            </Button>
            <p role="status" className="text-xs text-slate-600">
              {uploading
                ? 'Keep this page open until the upload finishes.'
                : 'Required before payment'}
            </p>
          </div>
        </>
      )}
    </section>
  );
}
