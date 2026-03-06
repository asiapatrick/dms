import { type Router, Router as createRouter } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { bufferToUuid } from '../lib/uid.js';
import { JWT_SECRET } from '../middleware/auth.js';

const router: Router = createRouter();

/**
 * POST /auth/login
 * Mock login — always authenticates as the demo user (demo@vistra.local).
 * Returns a JWT valid for 24 hours.
 */
router.post('/login', async (_req, res) => {
  const user = await prisma.user.findUnique({
    where: { email: 'demo@vistra.local' },
    select: { uid: true, name: true },
  });

  if (!user) {
    res.status(500).json({ error: 'Demo user not initialised — restart the server' });
    return;
  }

  const sub = bufferToUuid(user.uid as unknown as Uint8Array<ArrayBuffer>);
  const token = jwt.sign({ sub }, JWT_SECRET, { expiresIn: '24h' });

  res.json({ token, name: user.name });
});

export default router;
