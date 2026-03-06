"use client";

import { useRef, useState } from "react";
import Modal from "./Modal";
import { guessMimeType } from "@/lib/utils";

interface UploadFileModalProps {
  onClose: () => void;
  onSubmit: (data: {
    fileName: string;
    fileSizeBytes: number;
    mimeType: string;
  }) => Promise<void>;
}

export default function UploadFileModal({
  onClose,
  onSubmit,
}: UploadFileModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Please select a file.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        fileName: file.name,
        fileSizeBytes: file.size,
        mimeType: guessMimeType(file.name),
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Upload file" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {/* File picker */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">
            File <span className="text-red-500">*</span>
          </label>
          <input
            ref={inputRef}
            type="file"
            onChange={handleFileChange}
            className="text-sm text-zinc-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {file && (
            <p className="text-xs text-zinc-500">
              {file.name} &mdash; {(file.size / 1024).toFixed(1)} KB
            </p>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            {submitting ? "Uploading…" : "Upload"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
