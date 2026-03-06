import { type Router, Router as createRouter } from 'express';
import { Prisma } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { uuidToBuffer } from '../lib/uid.js';
import { toItemDTO } from '../lib/mappers.js';
import { listItemsQuerySchema } from '../types/dto.request.js';
import type { AncestorDTO, ItemDTO, ItemsResponse } from '@vistra/shared';

const router: Router = createRouter();

// Minimal row shapes returned from both ORM selects and raw MATCH queries.
type FolderRow = { uid: unknown; name: string; createdAt: Date };
type DocumentRow = { uid: unknown; fileName: string; fileSizeBytes: bigint; createdAt: Date };

/**
 * GET /items?folder=<folderUid>&page=1&limit=20&sortBy=name&sortDir=asc&search=<term>
 * List the contents of a folder (or root when ?folder is omitted).
 *
 * Folders are always grouped before documents, then sorted within each group
 * by the requested field. Both groups share the same sort direction.
 *
 * When ?search is provided (≥ 2 chars) the query uses MySQL ngram FULLTEXT
 * (MATCH … AGAINST … IN BOOLEAN MODE) so filtering is indexed and works
 * across all pages, not just the currently loaded one.
 *
 * Response: PaginatedResponse<ItemDTO>
 */
router.get('/', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const userName = req.user!.name;

  const queryResult = listItemsQuerySchema.safeParse(req.query);
  if (!queryResult.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid query parameters',
        details: queryResult.error.flatten(),
      },
    });
    return;
  }

  const { folder: folderParam, page, limit, sortBy, sortDir, search } = queryResult.data;

  // Resolve the parent folder's internal id (null = root)
  let folderId: bigint | null = null;
  if (folderParam !== undefined) {
    let folderBuf: Uint8Array<ArrayBuffer>;
    try {
      folderBuf = uuidToBuffer(folderParam);
    } catch {
      res.status(400).json({
        error: { code: 'INVALID_UID', message: 'Invalid folder UID' },
      });
      return;
    }

    const folder = await prisma.folder.findFirst({
      where: { uid: folderBuf, userId, status: 'ACTIVE' },
      select: { id: true },
    });

    if (!folder) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Folder not found' },
      });
      return;
    }

    folderId = folder.id;
  }

  // Map sortBy to the actual field names used in each table.
  const folderOrderField = sortBy === 'date' ? 'createdAt' : 'name';
  const documentOrderField = sortBy === 'date' ? 'createdAt' : 'fileName';
  const orderDir = sortDir;

  // ngram_token_size defaults to 2; single-char terms produce no results.
  // Treat search as absent when < 2 chars so the user sees all items while
  // still typing the first character.
  const effectiveSearch = search && search.length >= 2 ? search : undefined;

  // Pre-build SQL fragments reused across the two search queries.
  // folderOrderField / documentOrderField / orderDir are all validated by Zod
  // (enum values), so Prisma.raw is safe here.
  const folderParentCond = folderId === null
    ? Prisma.sql`parentFolderId IS NULL`
    : Prisma.sql`parentFolderId = ${folderId}`;
  const documentFolderCond = folderId === null
    ? Prisma.sql`folderId IS NULL`
    : Prisma.sql`folderId = ${folderId}`;

  // Fetch folders, documents, and ancestors in parallel.
  // When effectiveSearch is set, use MATCH … AGAINST (ngram FULLTEXT) instead
  // of Prisma ORM so the filter runs in the DB before pagination is applied.
  const [folders, documents, ancestors] = await Promise.all([
    (effectiveSearch
      ? prisma.$queryRaw<FolderRow[]>`
          SELECT uid, name, createdAt
          FROM folders
          WHERE userId = ${userId}
            AND ${folderParentCond}
            AND status = 'ACTIVE'
            AND MATCH(name) AGAINST(${effectiveSearch} IN BOOLEAN MODE)
          ORDER BY ${Prisma.raw(`${folderOrderField} ${orderDir}`)}
        `
      : prisma.folder.findMany({
          where: { userId, parentFolderId: folderId, status: 'ACTIVE' },
          select: { uid: true, name: true, createdAt: true },
          orderBy: { [folderOrderField]: orderDir },
        })
    ) as unknown as Promise<FolderRow[]>,

    (effectiveSearch
      ? prisma.$queryRaw<DocumentRow[]>`
          SELECT uid, fileName, fileSizeBytes, createdAt
          FROM documents
          WHERE userId = ${userId}
            AND ${documentFolderCond}
            AND status = 'ACTIVE'
            AND MATCH(fileName) AGAINST(${effectiveSearch} IN BOOLEAN MODE)
          ORDER BY ${Prisma.raw(`${documentOrderField} ${orderDir}`)}
        `
      : prisma.document.findMany({
          where: { userId, folderId, status: 'ACTIVE' },
          select: { uid: true, fileName: true, fileSizeBytes: true, createdAt: true },
          orderBy: { [documentOrderField]: orderDir },
        })
    ) as unknown as Promise<DocumentRow[]>,

    // Walk up the parent chain in a single recursive query (MySQL 8+).
    // steps_up=0 is the current folder; higher = closer to root.
    // ORDER BY steps_up DESC gives root-first order for the breadcrumb.
    folderId !== null
      ? prisma.$queryRaw<AncestorDTO[]>`
          WITH RECURSIVE ancestors AS (
            SELECT id, uid, name, parentFolderId, 0 AS steps_up
            FROM folders
            WHERE id = ${folderId}
            UNION ALL
            SELECT f.id, f.uid, f.name, f.parentFolderId, a.steps_up + 1
            FROM folders f
            INNER JOIN ancestors a ON f.id = a.parentFolderId
          )
          SELECT BIN_TO_UUID(uid, 1) AS uid, name
          FROM ancestors
          ORDER BY steps_up DESC
        `
      : Promise.resolve([]),
  ]);

  // Folders always listed before documents (standard file-explorer convention)
  const allItems: ItemDTO[] = [
    ...folders.map((f) => toItemDTO(f, f.name, 'folder', userName)),
    ...documents.map((d) => toItemDTO(d, d.fileName, 'document', userName)),
  ];

  const total = allItems.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * limit;
  const items = allItems.slice(offset, offset + limit);

  const response: ItemsResponse = {
    items,
    total,
    page: safePage,
    limit,
    totalPages,
    ancestors,
  };

  res.json(response);
});

export default router;
