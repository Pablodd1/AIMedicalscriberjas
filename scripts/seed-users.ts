import 'dotenv/config';
import { db } from '../server/db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../server/auth';

async function seedUsers() {
  console.log('Seeding default users...');

  const defaultUsers = [
    {
      username: 'admin',
      password: 'admin123',
      name: 'System Administrator',
      role: 'administrator' as const,
      email: 'admin@aims.medical',
      phone: '555-000-0001',
      specialty: 'Administration',
      isActive: true,
      useOwnApiKey: false,
    },
    {
      username: 'provider',
      password: 'provider123',
      name: 'Dr. John Smith',
      role: 'doctor' as const,
      email: 'provider@aims.medical',
      phone: '555-000-0002',
      specialty: 'Internal Medicine',
      licenseNumber: 'MD-12345',
      isActive: true,
      useOwnApiKey: false,
    },
    {
      username: 'doctor',
      password: 'doctor123',
      name: 'Dr. Sarah Johnson',
      role: 'doctor' as const,
      email: 'doctor@aims.medical',
      phone: '555-000-0003',
      specialty: 'Family Medicine',
      licenseNumber: 'MD-67890',
      isActive: true,
      useOwnApiKey: false,
    },
  ];

  for (const user of defaultUsers) {
    try {
      // Check if user already exists
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.username, user.username))
        .limit(1);

      if (existing.length === 0) {
        const hashedPassword = await hashPassword(user.password);
        await db.insert(users).values({
          ...user,
          password: hashedPassword,
          createdAt: new Date(),
        });
        console.log(`✓ Created user: ${user.username} (${user.role})`);
      } else {
        console.log(`- User already exists: ${user.username}`);
      }
    } catch (error: any) {
      if (error.code === '23505') {
        console.log(`- User already exists: ${user.username}`);
      } else {
        console.error(`✗ Error creating user ${user.username}:`, error.message);
      }
    }
  }

  console.log('\nSeed complete!');
  console.log('\n=== Default Login Credentials ===');
  console.log('Admin:    admin / admin123');
  console.log('Provider: provider / provider123');
  console.log('Doctor:   doctor / doctor123');
  console.log('================================\n');

  process.exit(0);
}

seedUsers().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
