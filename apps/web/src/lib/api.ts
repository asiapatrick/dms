import { API_BASE_URL } from "./config";
import type {
  FolderDTO,
  DocumentDTO,
  ItemsResponse,
} from "@/types";

// ---------------------------------------------------------------------------
// Token management (in-memory + localStorage fallback)
// ---------------------------------------------------------------------------

let _token: string | null = null;
let _userName: string | null = null;

export function getToken(): string | null {
  if (_token) return _token;
  if (typeof window !== "undefined") {
    _token = localStorage.getItem("dms_token");
  }
  return _token;
}

export function getUserName(): string {
  if (_userName) return _userName;
  if (typeof window !== "undefined") {
    _userName = localStorage.getItem("dms_user_name");
  }
  return _userName ?? "";
}

function setToken(token: string) {
  _token = token;
  if (typeof window !== "undefined") {
    localStorage.setItem("dms_token", token);
  }
}

function setUserName(name: string) {
  _userName = name;
  if (typeof window !== "undefined") {
    localStorage.setItem("dms_user_name", name);
  }
}

// ---------------------------------------------------------------------------
// Base fetch helper
// ---------------------------------------------------------------------------

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      _token = null;
      _userName = null;
      localStorage.removeItem("dms_token");
      localStorage.removeItem("dms_user_name");
      window.location.replace("/");
    }
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function login(): Promise<string> {
  const data = await apiFetch<{ token: string; name: string }>("/auth/login", {
    method: "POST",
  });
  setToken(data.token);
  setUserName(data.name);
  return data.token;
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export interface GetItemsParams {
  folder?: string;
  page?: number;
  limit?: number;
  sortBy?: "name" | "date";
  sortDir?: "asc" | "desc";
  /** Substring search (min 2 chars). Sent to the API for server-side ngram FULLTEXT filtering. */
  search?: string;
}

export async function getItems(
  params: GetItemsParams = {},
): Promise<ItemsResponse> {
  const qs = new URLSearchParams();
  if (params.folder) qs.set("folder", params.folder);
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.sortBy) qs.set("sortBy", params.sortBy);
  if (params.sortDir) qs.set("sortDir", params.sortDir);
  if (params.search) qs.set("search", params.search);

  const query = qs.toString();
  return apiFetch<ItemsResponse>(`/items${query ? `?${query}` : ""}`);
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

export interface CreateFolderBody {
  name: string;
  parentFolderUid?: string;
}

export async function createFolder(body: CreateFolderBody): Promise<FolderDTO> {
  return apiFetch<FolderDTO>("/folders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export interface CreateDocumentBody {
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  folderUid?: string;
}

export async function createDocument(
  body: CreateDocumentBody,
): Promise<DocumentDTO> {
  return apiFetch<DocumentDTO>("/documents", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
