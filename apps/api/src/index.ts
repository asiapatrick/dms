import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { seedDemoUser } from './seed.js';
import prisma from './lib/prisma.js';
import logger from './lib/logger.js';
import authRouter from './routes/auth.js';
import itemsRouter from './routes/items.js';
import documentsRouter from './routes/documents.js';
import foldersRouter from './routes/folders.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = process.env['PORT'] ?? 3000;

app.use(cors({
  origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3001',
}));
app.use(express.json());
app.use(pinoHttp({ logger }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRouter);
app.use('/items', itemsRouter);
app.use('/documents', documentsRouter);
app.use('/folders', foldersRouter);
app.use(errorHandler);

await seedDemoUser();

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Server running');
});

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Shutting down');
  server.close(async () => {
    await prisma.$disconnect();
    logger.info('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
