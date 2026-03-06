"use client";

import type { ItemDTO } from "@/types";
import { formatDate, formatFileSize } from "@/lib/utils";

interface DocumentsTableProps {
  items: ItemDTO[];
  selectedIds: Set<string>;
  onToggleSelect: (uid: string) => void;
  onToggleSelectAll: (uids: string[]) => void;
  onFolderClick: (item: ItemDTO) => void;
}

export default function DocumentsTable({
  items,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onFolderClick,
}: DocumentsTableProps) {
  const allSelected = items.length > 0 && items.every((i) => selectedIds.has(i.uid));
  const someSelected = items.some((i) => selectedIds.has(i.uid));

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200">
      <table className="w-full text-sm text-zinc-700">
        <thead>
          <tr className="bg-zinc-50 border-b border-zinc-200">
            <th className="w-10 px-4 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = !allSelected && someSelected;
                }}
                onChange={() =>
                  onToggleSelectAll(items.map((i) => i.uid))
                }
                className="w-4 h-4 rounded border-zinc-300 accent-blue-600 cursor-pointer"
                aria-label="Select all"
              />
            </th>
            <th className="px-4 py-3 text-left font-semibold text-zinc-600 text-xs uppercase tracking-wide">
              Name
            </th>
            <th className="px-4 py-3 text-left font-semibold text-zinc-600 text-xs uppercase tracking-wide whitespace-nowrap">
              Created by
            </th>
            <th className="px-4 py-3 text-left font-semibold text-zinc-600 text-xs uppercase tracking-wide">
              Date
            </th>
            <th className="px-4 py-3 text-right font-semibold text-zinc-600 text-xs uppercase tracking-wide whitespace-nowrap">
              File size
            </th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className="px-4 py-12 text-center text-zinc-400 text-sm"
              >
                No items found.
              </td>
            </tr>
          ) : (
            items.map((item, idx) => (
              <tr
                key={item.uid}
                className={`border-b border-zinc-100 transition-colors hover:bg-blue-50/40 ${
                  selectedIds.has(item.uid) ? "bg-blue-50" : idx % 2 === 0 ? "bg-white" : "bg-zinc-50/50"
                }`}
              >
                <td className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.uid)}
                    onChange={() => onToggleSelect(item.uid)}
                    className="w-4 h-4 rounded border-zinc-300 accent-blue-600 cursor-pointer"
                    aria-label={`Select ${item.name}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2">
                    <span className="text-base leading-none" aria-hidden>
                      {item.type === "folder" ? "📁" : "📄"}
                    </span>
                    {item.type === "folder" ? (
                      <button
                        onClick={() => onFolderClick(item)}
                        className="font-medium text-blue-600 hover:underline truncate max-w-xs text-left"
                        title={item.name}
                      >
                        {item.name}
                      </button>
                    ) : (
                      <span
                        className="font-medium text-zinc-800 truncate max-w-xs"
                        title={item.name}
                      >
                        {item.name}
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                  {item.createdBy}
                </td>
                <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                  {formatDate(item.createdAt)}
                </td>
                <td className="px-4 py-3 text-right text-zinc-600 whitespace-nowrap">
                  {item.type === "folder"
                    ? "-"
                    : formatFileSize(item.fileSizeBytes)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
