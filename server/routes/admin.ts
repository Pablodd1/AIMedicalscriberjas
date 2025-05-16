import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { eq } from 'drizzle-orm';
import { users } from '@shared/schema';
import { pool } from '../db';

export const adminRouter = Router();

// Middleware to check if user has admin access
const checkAdminAccess = (req: Request, res: Response, next: Function) => {
  // Special case for direct password access through frontend
  const adminPassword = req.headers['x-admin-password'];
  if (adminPassword === 'admin@@@') {
    return next();
  }
  
  // For API endpoints, we check if the user is authenticated and has admin role
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }
  
  next();
};

// Apply admin access check middleware to all routes
adminRouter.use(checkAdminAccess);

// Get all users
adminRouter.get('/users', async (req: Request, res: Response) => {
  try {
    const includePasswords = req.query.includePasswords === 'true';
    
    if (includePasswords) {
      // These are the default/known passwords for demo accounts
      const plainPasswords = {
        'doctor': 'password123',
        'admin': 'adminpass',
        'assistant': 'assistant123',
        'ali': 'alipass',
        'ali819': 'ali819pass',
        'patient1': 'patient123',
        'patient2': 'patient456'
      };
      
      // Use direct database query to include passwords
      const result = await pool.query(`
        SELECT id, username, password, name, email, role, 
               phone, specialty, license_number, avatar, bio, 
               is_active as "isActive", 
               created_at as "createdAt", 
               last_login as "lastLogin"
        FROM users
        ORDER BY id
      `);
      
      // Add plain text passwords for each user
      const usersWithPlainPasswords = result.rows.map(user => ({
        ...user,
        plain_password: plainPasswords[user.username] || 'default123' // Default if username not in our mapping
      }));
      
      return res.json(usersWithPlainPasswords);
    } else {
      // Use storage method which excludes passwords
      const users = await storage.getUsers();
      res.json(users);
    }
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Update user status (active/inactive)
adminRouter.patch('/users/:userId/status', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const { isActive } = req.body;
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean' });
    }
    
    // Don't allow changing status of the main admin (ID 1)
    if (userId === 1) {
      return res.status(403).json({ error: 'Cannot modify the status of the primary admin account' });
    }
    
    const updatedUser = await storage.updateUser(userId, { isActive });
    
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Update user role
adminRouter.patch('/users/:userId/role', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const { role } = req.body;
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    if (!['doctor', 'admin', 'assistant', 'patient'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    // Don't allow changing role of the main admin (ID 1)
    if (userId === 1) {
      return res.status(403).json({ error: 'Cannot modify the role of the primary admin account' });
    }
    
    const updatedUser = await storage.updateUser(userId, { role });
    
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Delete a user
adminRouter.delete('/users/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    // Don't allow deleting the main admin (ID 1)
    if (userId === 1) {
      return res.status(403).json({ error: 'Cannot delete the primary admin account' });
    }
    
    const deleted = await storage.deleteUser(userId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'User not found or could not be deleted' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Update the Schema to include isActive field
// This is necessary as we're using the isActive field for user management
adminRouter.get('/update-schema', async (req: Request, res: Response) => {
  try {
    // We are using the db directly from the pool since we already have the isActive field in our schema
    // This is just for verification purposes
    const result = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_active'"
    );
    
    if (result.rows.length === 0) {
      // Just in case, if column doesn't exist, add it
      await pool.query("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE");
      return res.json({ message: 'Schema updated successfully' });
    }
    
    return res.json({ message: 'Schema already up to date' });
  } catch (error) {
    console.error('Error updating schema:', error);
    res.status(500).json({ error: 'Failed to update schema' });
  }
});

// Admin dashboard data
adminRouter.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const users = await storage.getUsers();
    const patients = await storage.getPatients(-1); // -1 to get all patients
    
    const stats = {
      totalUsers: users.length,
      activeUsers: users.filter(u => u.isActive).length,
      inactiveUsers: users.filter(u => !u.isActive).length,
      usersByRole: {
        admin: users.filter(u => u.role === 'admin').length,
        doctor: users.filter(u => u.role === 'doctor').length,
        assistant: users.filter(u => u.role === 'assistant').length,
        patient: users.filter(u => u.role === 'patient').length,
      },
      totalPatients: patients.length,
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error getting dashboard data:', error);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
});