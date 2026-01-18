import { describe, it, expect, beforeEach } from 'vitest';
import { MockStorage } from '../../server/mock-storage';
import { insertUserSchema, insertPatientSchema } from '../../shared/schema';

describe('MockStorage', () => {
  let storage: MockStorage;

  beforeEach(() => {
    storage = new MockStorage();
  });

  it('should create and retrieve a user', async () => {
    const newUser = {
      username: 'testuser',
      password: 'hashedpassword',
      name: 'Test User',
      email: 'test@example.com',
      role: 'doctor' as const,
      isActive: true,
    };

    const created = await storage.createUser(newUser);
    expect(created.id).toBeDefined();
    expect(created.username).toBe(newUser.username);

    const retrieved = await storage.getUser(created.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.username).toBe(newUser.username);
  });

  it('should create and retrieve a patient', async () => {
    // First create a doctor (user)
    const doctor = await storage.createUser({
        username: 'doc',
        password: 'pw',
        name: 'Dr. Test',
        email: 'doc@test.com',
        role: 'doctor'
    });

    const newPatient = {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      createdBy: doctor.id
    };

    const created = await storage.createPatient(newPatient);
    expect(created.id).toBeDefined();
    expect(created.firstName).toBe('Jane');

    const retrieved = await storage.getPatient(created.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.email).toBe('jane@example.com');
  });
});
