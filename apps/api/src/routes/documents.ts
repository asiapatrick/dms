import { type Router, Router as createRouter } from 'express';
import { Prisma } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { bufferToUuid, uuidToBuffer } from '../lib/uid.js';
import { toDocumentInternal, toDocumentDTO } from '../lib/mappers.js';
import { createDocumentSchema } from '../types/dto.request.js';
import type { DocumentDTO } from '@vistra/shared';

const router: Router = createRouter();

/**
 * POST /documents
 * Simulate uploading a document (no actual file or S3 involved).
 *
 * Body: CreateDocumentReq
 *   fileName      string   — original file name (e.g. "report.pdf")
 *   fileSizeBytes number   — file size in bytes
 *   mimeType      string   — MIME type (derived by the client from the extension)
 *   folderUid     string?  — UID of the target folder; omit or null for root
 */
router.post('/', requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const result = createDocumentSchema.safeParse(req.body);
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

  const { fileName, fileSizeBytes, mimeType, folderUid } = result.data;

  // Resolve optional target folder
  let folderId: bigint | null = null;
  if (folderUid != null) {
    let folderBuf: Uint8Array<ArrayBuffer>;
    try {
      folderBuf = uuidToBuffer(folderUid);
    } catch {
      res.status(400).json({
        error: { code: 'INVALID_UID', message: 'Invalid folderUid' },
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

  // MySQL unique indexes treat NULL as distinct, so the DB constraint won't catch
  // root-level duplicates (folderId IS NULL). Check explicitly here.
  if (folderId === null) {
    const existing = await prisma.document.findFirst({
      where: { userId, folderId: null, fileName, status: 'ACTIVE' },
      select: { id: true },
    });
    if (existing) {
      res.status(409).json({
        error: { code: 'CONFLICT', message: 'A document with that name already exists here' },
      });
      return;
    }
  }

  // Generate a placeholder S3 key (no actual upload)
  const ownerUid = bufferToUuid(req.user!.uid);
  const s3Key = `uploads/${ownerUid}/${Date.now()}-${fileName}`;

  try {
    const doc = await prisma.document.create({
      data: {
        userId,
        folderId,
        fileName,
        s3Key,
        mimeType,
        fileSizeBytes: BigInt(fileSizeBytes),
      },
      select: {
        uid: true,
        fileName: true,
        s3Key: true,
        mimeType: true,
        fileSizeBytes: true,
        status: true,
        createdAt: true,
      },
    });

    // Build internal (with s3Key), then strip it for the client response
    const internal = toDocumentInternal(doc, folderUid ?? null);
    const dto: DocumentDTO = toDocumentDTO(internal);
    res.status(201).json(dto);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({
        error: { code: 'CONFLICT', message: 'A document with that name already exists here' },
      });
      return;
    }
    throw err;
  }
});

export default router;
