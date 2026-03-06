"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AncestorDTO, ItemDTO } from "@/types";
import {
  getItems,
  createFolder,
  createDocument,
  getToken,
  getUserName,
} from "@/lib/api";
import DocumentsTable from "@/components/DocumentsTable";
import Pagination from "@/components/Pagination";
import UploadFileModal from "@/components/UploadFileModal";
import AddFolderModal from "@/components/AddFolderModal";

type Modal = "upload" | "addFolder" | null;

export default function DocumentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL is the source of truth for the current folder
  const currentFolderUid = searchParams.get("folder") ?? undefined;

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [items, setItems] = useState<ItemDTO[]>([]);
  const [ancestors, setAncestors] = useState<AncestorDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [numPages, setNumPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  // Debounced value actually sent to the API — updated 300 ms after the user stops typing.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<Modal>(null);

  // ---------------------------------------------------------------------------
  // Debounce: commit search to API 300 ms after typing stops, reset to page 1
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // ---------------------------------------------------------------------------
  // Auth + fetch — reruns whenever folder, page, perPage, or debouncedSearch changes
  // ---------------------------------------------------------------------------

  const fetchAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
      return;
    }

    // Cancel any in-flight request
    fetchAbort.current?.abort();
    const ac = new AbortController();
    fetchAbort.current = ac;

    setLoading(true);
    setError(null);

    getItems({
      page,
      limit: perPage,
      sortBy: "name",
      sortDir: "asc",
      folder: currentFolderUid,
      search: debouncedSearch || undefined,
    })
      .then((data) => {
        if (ac.signal.aborted) return;
        setItems(data.items);
        setAncestors(data.ancestors);
        setTotal(data.total);
        setNumPages(data.totalPages);
      })
      .catch((err) => {
        if (ac.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load items.");
      })
      .finally(() => {
        if (ac.signal.aborted) return;
        setLoading(false);
      });

    return () => ac.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolderUid, page, perPage, debouncedSearch]);

  // Reset to page 1 when folder changes; also clear search immediately
  const prevFolderRef = useRef(currentFolderUid);
  useEffect(() => {
    if (currentFolderUid !== prevFolderRef.current) {
      prevFolderRef.current = currentFolderUid;
      setPage(1);
      setSearch("");
      setDebouncedSearch("");
      setSelectedIds(new Set());
    }
  }, [currentFolderUid]);

  useEffect(() => {
    setPage(1);
  }, [perPage]);

  // ---------------------------------------------------------------------------
  // Folder navigation
  // ---------------------------------------------------------------------------

  function handleFolderClick(item: ItemDTO) {
    router.push(`/documents?folder=${item.uid}`);
  }

  function handleBreadcrumbNav(index: number) {
    if (index === -1) {
      router.push("/documents");
    } else {
      // ancestors includes current folder as last item; index here is a parent
      router.push(`/documents?folder=${ancestors[index].uid}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Selection handlers
  // ---------------------------------------------------------------------------

  function handleToggleSelect(uid: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  }

  function handleToggleSelectAll(uids: string[]) {
    const allSelected = uids.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        uids.forEach((id) => next.delete(id));
      } else {
        uids.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // Modal submit handlers
  // ---------------------------------------------------------------------------

  async function handleUploadSubmit(data: {
    fileName: string;
    fileSizeBytes: number;
    mimeType: string;
  }) {
    const doc = await createDocument({ ...data, folderUid: currentFolderUid });
    const newItem: ItemDTO = {
      uid: doc.uid,
      name: doc.fileName,
      type: "document",
      createdAt: doc.createdAt,
      createdBy: getUserName(),
      fileSizeBytes: String(doc.fileSizeBytes),
    };
    setItems((prev) => [...prev, newItem]);
  }

  async function handleAddFolderSubmit(data: { name: string }) {
    const folder = await createFolder({ ...data, parentFolderUid: currentFolderUid });
    const newItem: ItemDTO = {
      uid: folder.uid,
      name: folder.name,
      type: "folder",
      createdAt: folder.createdAt,
      createdBy: getUserName(),
    };
    setItems((prev) => [newItem, ...prev]);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
            Documents
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setModal("upload")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              <span>↑</span>
              Upload files
            </button>
            <button
              onClick={() => setModal("addFolder")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-700 text-sm font-medium hover:bg-zinc-50 transition-colors shadow-sm"
            >
              <span>📁</span>
              Add new folder
            </button>
          </div>
        </div>

        {/* ── Breadcrumb ── */}
        <nav className="flex items-center gap-1 text-sm mb-5 text-zinc-500">
          <button
            onClick={() => handleBreadcrumbNav(-1)}
            className={`hover:text-zinc-900 transition-colors ${ancestors.length === 0 ? "font-semibold text-zinc-900 cursor-default pointer-events-none" : ""}`}
          >
            My Folder
          </button>
          {ancestors.map((ancestor, i) => {
            const isLast = i === ancestors.length - 1;
            return (
              <span key={ancestor.uid} className="flex items-center gap-1">
                <span className="text-zinc-300">/</span>
                {isLast ? (
                  <span className="font-semibold text-zinc-900">{ancestor.name}</span>
                ) : (
                  <button
                    onClick={() => handleBreadcrumbNav(i)}
                    className="hover:text-zinc-900 transition-colors"
                  >
                    {ancestor.name}
                  </button>
                )}
              </span>
            );
          })}
        </nav>

        {/* ── Search bar ── */}
        <div className="relative mb-5">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none select-none">
            🔍
          </span>
          <input
            type="search"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-zinc-300 rounded-xl bg-white text-sm text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                getItems({ page, limit: perPage, sortBy: "name", sortDir: "asc", folder: currentFolderUid })
                  .then((data) => { setItems(data.items); setAncestors(data.ancestors); setTotal(data.total); setNumPages(data.totalPages); })
                  .catch((err) => setError(err instanceof Error ? err.message : "Failed to load items."))
                  .finally(() => setLoading(false));
              }}
              className="ml-4 text-red-600 font-medium hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Table ── */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-zinc-400 text-sm gap-2">
            <span className="animate-spin">⏳</span>
            Loading…
          </div>
        ) : (
          <>
            <DocumentsTable
              items={items}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onToggleSelectAll={handleToggleSelectAll}
              onFolderClick={handleFolderClick}
            />

            {/* ── Pagination ── */}
            <Pagination
              page={page}
              totalPages={numPages}
              perPage={perPage}
              total={total}
              onPageChange={setPage}
              onPerPageChange={(n) => {
                setPerPage(n);
                setPage(1);
              }}
            />
          </>
        )}
      </div>

      {/* ── Modals ── */}
      {modal === "upload" && (
        <UploadFileModal
          onClose={() => setModal(null)}
          onSubmit={handleUploadSubmit}
        />
      )}
      {modal === "addFolder" && (
        <AddFolderModal
          onClose={() => setModal(null)}
          onSubmit={handleAddFolderSubmit}
        />
      )}
    </div>
  );
}
