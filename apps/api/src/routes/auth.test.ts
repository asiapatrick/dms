import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../lib/prisma.js', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import authRouter from './auth.js';
import prisma from '../lib/prisma.js';
import { uuidToBuffer } from '../lib/uid.js';

const app = express();
app.use(express.json());
app.use('/auth', authRouter);

const mockFindUnique = vi.mocked(prisma.user.findUnique);
const DEMO_UUID = '550e8400-e29b-41d4-a716-446655440000';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /auth/login', () => {
  it('returns 500 when demo user is not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await request(app).post('/auth/login');
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });

  it('returns a JWT token and name when demo user exists', async () => {
    mockFindUnique.mockResolvedValue({
      uid: uuidToBuffer(DEMO_UUID),
      name: 'Demo User',
    });
    const res = await request(app).post('/auth/login');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('name', 'Demo User');
    // JWT is three base64url segments separated by dots
    expect(res.body.token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
  });
});
