export interface FolderDTO {
  uid: string;
  name: string;
  status: string;
  createdAt: string;
  parentFolderUid: string | null;
}

export interface DocumentDTO {
  uid: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: string; // BigInt serialised as string from API
  status: string;
  createdAt: string;
  folderUid: string | null;
}

// ItemDTO returned by GET /items — fileSizeBytes is a string (BigInt serialised)
export interface ItemDTO {
  uid: string;
  name: string;
  type: "folder" | "document";
  createdAt: string;
  createdBy: string;
  fileSizeBytes?: string;
}

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

export type ItemsResponse = PaginatedResponse<ItemDTO> & {
  ancestors: AncestorDTO[];
};
