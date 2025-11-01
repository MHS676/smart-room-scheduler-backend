import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {

  const hashed = await bcrypt.hash('ceo_password_123', 10);
  await prisma.user.upsert({
    where: { email: 'ceo@company.local' },
    update: {},
    create: {
      name: 'CEO',
      email: 'ceo@company.local',
      password: hashed,
      role: 'CEO',
    },
  });


  const rooms = [
    { name: 'Room A', capacity: 12, equipment: ['projector', 'whiteboard'], hourlyRate: 30, location: 'Bldg 1 - 1F' },
    { name: 'Room B', capacity: 8, equipment: ['video-conf', 'whiteboard'], hourlyRate: 25, location: 'Bldg 1 - 1F' },
    { name: 'Room C', capacity: 20, equipment: ['projector', 'video-conf'], hourlyRate: 50, location: 'Bldg 1 - 2F' },
    { name: 'Room D', capacity: 4, equipment: ['whiteboard'], hourlyRate: 10, location: 'Bldg 1 - 2F' },
    { name: 'Room E', capacity: 6, equipment: ['projector'], hourlyRate: 20, location: 'Bldg 1 - 3F' },
    { name: 'Room F', capacity: 10, equipment: ['video-conf', 'projector'], hourlyRate: 35, location: 'Bldg 2 - 1F' },
    { name: 'Room G', capacity: 2, equipment: [], hourlyRate: 5, location: 'Bldg 2 - 1F' },
    { name: 'Room H', capacity: 15, equipment: ['video-conf', 'whiteboard'], hourlyRate: 40, location: 'Bldg 2 - 2F' },
    { name: 'Room I', capacity: 30, equipment: ['projector', 'video-conf'], hourlyRate: 80, location: 'Bldg 2 - 3F' },
    { name: 'Room J', capacity: 5, equipment: ['whiteboard'], hourlyRate: 12, location: 'Bldg 2 - 3F' },
  ];

  for (const r of rooms) {
    await prisma.meetingRoom.upsert({
      where: { name: r.name },
      update: {},
      create: r,
    });
  }


  await prisma.ticket.upsert({
    where: { title: 'Standard Ticket' },
    update: {},
    create: {
      title: 'Standard Ticket',
      price: 10,
      quantity: 100,
    },
  });

  console.log('Seed complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
