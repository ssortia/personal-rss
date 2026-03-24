import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('admin123456', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: { role: 'ADMIN' },
    create: {
      email: 'admin@example.com',
      password,
      role: 'ADMIN',
    },
  });

  console.log('Seeded admin user:', admin.email, 'role:', admin.role);

  const categories = [
    { name: 'Технологии', slug: 'technology' },
    { name: 'Наука', slug: 'science' },
    { name: 'Бизнес', slug: 'business' },
    { name: 'Политика', slug: 'politics' },
    { name: 'Спорт', slug: 'sports' },
    { name: 'Здоровье', slug: 'health' },
    { name: 'Культура', slug: 'culture' },
    { name: 'Образование', slug: 'education' },
    { name: 'Финансы', slug: 'finance' },
    { name: 'Путешествия', slug: 'travel' },
    { name: 'Игры', slug: 'gaming' },
    { name: 'Кино и сериалы', slug: 'movies' },
    { name: 'Музыка', slug: 'music' },
    { name: 'Дизайн', slug: 'design' },
    { name: 'Еда', slug: 'food' },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name },
      create: category,
    });
  }

  console.log(`Seeded ${categories.length} categories`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
