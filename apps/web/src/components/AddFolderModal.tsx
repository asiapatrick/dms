"use client";

import { useState } from "react";
import Modal from "./Modal";

interface AddFolderModalProps {
  onClose: () => void;
  onSubmit: (data: { name: string }) => Promise<void>;
}

export default function AddFolderModal({
  onClose,
  onSubmit,
}: AddFolderModalProps) {
  const [form, setForm] = useState({ name: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Folder name is required.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await onSubmit({
        name: form.name.trim(),
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Add new folder" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {/* Folder name */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">
            Folder name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Policy approvals"
            value={form.name}
            onChange={(e) => {
              setForm({ ...form, name: e.target.value });
              if (error) setError("");
            }}
            className={`border rounded-lg px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-blue-500 ${
              error ? "border-red-400" : "border-zinc-300"
            }`}
          />
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
            {submitting ? "Creating…" : "Create folder"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
