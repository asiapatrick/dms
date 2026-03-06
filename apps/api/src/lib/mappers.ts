import { bufferToUuid } from "./uid.js";
import type { FolderDTO, DocumentDTO, ItemDTO, ItemStatus } from "@vistra/shared";
import type { DocumentInternal } from "../types/internal.js";

// ---------------------------------------------------------------------------
// Shared helper — Prisma returns uid as a Buffer-like Uint8Array
// ---------------------------------------------------------------------------

function uidToString(uid: unknown): string {
  return bufferToUuid(uid as Uint8Array<ArrayBuffer>);
}

// ---------------------------------------------------------------------------
// Folder
// ---------------------------------------------------------------------------

/** Minimal shape selected from Prisma when building a FolderDTO. */
export type PrismaFolderRow = {
  uid: unknown;
  name: string;
  status: string;
  createdAt: Date;
};

/**
 * Convert a Prisma folder row to a FolderDTO.
 *
 * @param row           - Selected Prisma row (uid as raw Buffer).
 * @param parentFolderUid - Pre-resolved parent UID string, or null for root.
 *                          The caller already has this from the request or a
 *                          prior DB lookup, so no extra join is needed here.
 */
export function toFolderDTO(
  row: PrismaFolderRow,
  parentFolderUid: string | null,
): FolderDTO {
  return {
    uid: uidToString(row.uid),
    name: row.name,
    parentFolderUid,
    status: row.status as ItemStatus,
    createdAt: row.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

/** Minimal shape selected from Prisma when building a DocumentInternal. */
export type PrismaDocumentRow = {
  uid: unknown;
  fileName: string;
  s3Key: string;
  mimeType: string;
  fileSizeBytes: bigint;
  status: string;
  createdAt: Date;
};

/**
 * Convert a Prisma document row to DocumentInternal (includes s3Key).
 *
 * @param row       - Selected Prisma row.
 * @param folderUid - Pre-resolved folder UID string, or null for root.
 */
export function toDocumentInternal(
  row: PrismaDocumentRow,
  folderUid: string | null,
): DocumentInternal {
  return {
    uid: uidToString(row.uid),
    fileName: row.fileName,
    s3Key: row.s3Key,
    mimeType: row.mimeType,
    /** BigInt serialised as decimal string — safe for JSON.stringify. */
    fileSizeBytes: row.fileSizeBytes.toString(),
    folderUid,
    status: row.status as ItemStatus,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Strip s3Key from a DocumentInternal before sending to the client.
 * The rest spread produces exactly DocumentDTO — TypeScript verifies this.
 */
export function toDocumentDTO(internal: DocumentInternal): DocumentDTO {
  const { s3Key: _stripped, ...dto } = internal;
  return dto;
}

// ---------------------------------------------------------------------------
// Item (flat browse list)
// ---------------------------------------------------------------------------

export function toItemDTO(
  row: { uid: unknown; createdAt: Date; fileSizeBytes?: bigint },
  name: string,
  type: "folder" | "document",
  createdBy: string,
): ItemDTO {
  return {
    uid: uidToString(row.uid),
    name,
    type,
    createdAt: row.createdAt.toISOString(),
    createdBy,
    ...(row.fileSizeBytes !== undefined && {
      fileSizeBytes: row.fileSizeBytes.toString(),
    }),
  };
}
