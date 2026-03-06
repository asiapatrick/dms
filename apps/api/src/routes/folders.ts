import { type Router, Router as createRouter } from 'express';
import { Prisma } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { uuidToBuffer } from '../lib/uid.js';
import { toFolderDTO } from '../lib/mappers.js';
import { createFolderSchema } from '../types/dto.request.js';
import type { FolderDTO } from '@vistra/shared';

const router: Router = createRouter();

/**
 * POST /folders
 * Create a new folder.
 *
 * Body: CreateFolderReq
 *   name              string   — folder name
 *   parentFolderUid   string?  — UID of the parent folder; omit or null for root
 */
router.post('/', requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const result = createFolderSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: result.error.flatten(),
      },
    });
    return;
  }

  const { name, parentFolderUid } = result.data;

  // Resolve optional parent folder
  let parentFolderId: bigint | null = null;
  if (parentFolderUid != null) {
    let buf: Uint8Array<ArrayBuffer>;
    try {
      buf = uuidToBuffer(parentFolderUid);
    } catch {
      res.status(400).json({
        error: { code: 'INVALID_UID', message: 'Invalid parentFolderUid' },
      });
      return;
    }
    const parent = await prisma.folder.findFirst({
      where: { uid: buf, userId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!parent) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Parent folder not found' },
      });
      return;
    }
    parentFolderId = parent.id;
  }

  // MySQL unique indexes treat NULL as distinct, so the DB constraint won't catch
  // root-level duplicates (parentFolderId IS NULL). Check explicitly here.
  if (parentFolderId === null) {
    const existing = await prisma.folder.findFirst({
      where: { userId, parentFolderId: null, name, status: 'ACTIVE' },
      select: { id: true },
    });
    if (existing) {
      res.status(409).json({
        error: { code: 'CONFLICT', message: 'A folder with that name already exists here' },
      });
      return;
    }
  }

  try {
    const folder = await prisma.folder.create({
      data: { userId, name, parentFolderId },
      select: { uid: true, name: true, status: true, createdAt: true },
    });

    const dto: FolderDTO = toFolderDTO(folder, parentFolderUid ?? null);
    res.status(201).json(dto);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({
        error: { code: 'CONFLICT', message: 'A folder with that name already exists here' },
      });
      return;
    }
    throw err;
  }
});

export default router;
