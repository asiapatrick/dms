// Response DTOs are interfaces because they are public API contracts —
// consumers (frontend, SDK) may extend them (e.g. AdminFolderDTO extends FolderDTO).

import type { ItemStatus } from "./enums";

export interface FolderDTO {
  uid: string;
  name: string;
  parentFolderUid: string | null;
  status: ItemStatus;
  createdAt: string; // ISO 8601
}

export interface DocumentDTO {
  uid: string;
  fileName: string;
  mimeType: string;
  /** BigInt serialised as a decimal string for JSON safety. */
  fileSizeBytes: string;
  folderUid: string | null;
  status: ItemStatus;
  createdAt: string; // ISO 8601
}

/** Allowed sort fields for the browse/list endpoint. */
export type ItemSortField = "name" | "date";

/** Flat item used by the browse/list endpoint. */
export interface ItemDTO {
  uid: string;
  name: string;
  type: "folder" | "document";
  createdAt: string; // ISO 8601
  createdBy: string;
  /** Present only for documents; absent for folders. */
  fileSizeBytes?: string;
}

/** Generic pagination envelope returned by paginated list endpoints. */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AncestorDTO {
  uid: string;
  name: string;
}

/** Response type for GET /items — extends pagination with folder breadcrumb. */
export type ItemsResponse = PaginatedResponse<ItemDTO> & {
  /** Ordered root → direct parent. Empty array when listing root. */
  ancestors: AncestorDTO[];
};
