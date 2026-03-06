import prisma from './lib/prisma.js';

export async function seedDemoUser(): Promise<void> {
  await prisma.user.upsert({
    where: { email: 'demo@vistra.local' },
    update: {},
    create: {
      name: 'Demo User',
      email: 'demo@vistra.local',
    },
  });
  console.log('[seed] Demo user ready: demo@vistra.local');
}
