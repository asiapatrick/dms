import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { uuidToBuffer } from '../lib/uid.js';

export const JWT_SECRET = process.env['JWT_SECRET'] ?? 'demo-secret-change-in-production';

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' },
    });
    return;
  }

  const token = authHeader.slice(7);

  let sub: string;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (typeof payload === 'string' || typeof payload['sub'] !== 'string') {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Invalid token payload' },
      });
      return;
    }
    sub = payload['sub'];
  } catch {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
    });
    return;
  }

  let uidBuf: Uint8Array<ArrayBuffer>;
  try {
    uidBuf = uuidToBuffer(sub);
  } catch {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Malformed token subject' },
    });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { uid: uidBuf },
    select: { id: true, uid: true, name: true, status: true },
  });

  if (!user || user.status !== 'ACTIVE') {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'User not found or inactive' },
    });
    return;
  }

  req.user = { id: user.id, uid: user.uid as unknown as Uint8Array<ArrayBuffer>, name: user.name };
  next();
}
