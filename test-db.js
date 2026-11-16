const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const c = await prisma.$queryRawUnsafe('DESCRIBE customers');
  console.log('CUSTOMERS:', c.map(x => x.Field));
  const p = await prisma.$queryRawUnsafe('DESCRIBE patients');
  console.log('PATIENTS:', p.map(x => x.Field));
}
main().catch(console.error).finally(() => prisma.$disconnect());

