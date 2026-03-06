import { z } from "zod";

// ---------------------------------------------------------------------------
// Folder
// ---------------------------------------------------------------------------

export const createFolderSchema = z.object({
  name: z.string().min(1, "name is required"),
  /** Omit or pass null/undefined to create at root level. */
  parentFolderUid: z.string().nullable().optional(),
});

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export const createDocumentSchema = z.object({
  fileName: z.string().min(1, "fileName is required"),
  fileSizeBytes: z
    .number()
    .int()
    .nonnegative("fileSizeBytes must be a non-negative integer"),
  mimeType: z.string().min(1, "mimeType is required"),
  /** Omit or pass null/undefined to place at root level. */
  folderUid: z.string().nullable().optional(),
});

// ---------------------------------------------------------------------------
// List / query params
// ---------------------------------------------------------------------------

/** Query params for GET /items */
export const listItemsQuerySchema = z.object({
  folder: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().min(1).max(100).default(20),
  /** Sort column: "name" (alphabetical) or "date" (createdAt). */
  sortBy: z.enum(["name", "date"]).default("name"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
  /**
   * Substring search applied server-side via ngram FULLTEXT index.
   * Minimum 2 characters (ngram_token_size default); shorter values are
   * treated as no search by the route handler.
   */
  search: z.string().trim().optional(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript types — no need to write these manually; Zod owns them.
// ---------------------------------------------------------------------------

export type CreateFolderReq = z.infer<typeof createFolderSchema>;
export type CreateDocumentReq = z.infer<typeof createDocumentSchema>;
export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>;
