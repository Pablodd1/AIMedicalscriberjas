import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { eq } from 'drizzle-orm';
import { users } from '@shared/schema';
import { pool } from '../db';
import { hashPassword } from '../auth';
import { z } from 'zod';

export const adminRouter = Router();

const ROLE_VALUES = ['administrator', 'admin', 'doctor', 'assistant', 'patient'] as const;
const createUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('A valid email is required'),
  role: z.enum(ROLE_VALUES).default('doctor'),
  phone: z.string().optional(),
  specialty: z.string().optional(),
  licenseNumber: z.string().optional(),
  isActive: z.boolean().optional(),
});

// Middleware to check if user has admin access
const checkAdminAccess = (req: Request, res: Response, next: Function) => {
  // For API endpoints, we check if the user is authenticated and has admin role
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  if (!req.user || !['admin', 'administrator'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }
  
  next();
};

// Apply admin access check middleware to all routes
adminRouter.use(checkAdminAccess);

// Get all users
adminRouter.get('/users', async (req: Request, res: Response) => {
  try {
    // Use storage method which excludes passwords (secure approach)
    const users = await storage.getUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Create a new user account
adminRouter.post('/users', async (req: Request, res: Response) => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid user payload', details: parsed.error.format() });
    }

    const data = parsed.data;

    // Prevent non-global admins from creating global administrators
    if (data.role === 'administrator' && req.user && req.user.role !== 'administrator') {
      return res.status(403).json({ error: 'Only global administrators can create another global administrator' });
    }

    const existingByUsername = await storage.getUserByUsername(data.username);
    if (existingByUsername) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const existingByEmail = await storage.getUserByEmail(data.email);
    if (existingByEmail) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const hashedPassword = await hashPassword(data.password);
    const newUser = await storage.createUser({
      username: data.username,
      password: hashedPassword,
      name: data.name,
      email: data.email,
      role: data.role,
      phone: data.phone ?? null,
      specialty: data.specialty ?? null,
      licenseNumber: data.licenseNumber ?? null,
      avatar: null,
      bio: null,
      isActive: data.isActive ?? true,
    });

    if (!newUser) {
      return res.status(500).json({ error: 'Failed to create user' });
    }

    const { password, ...userWithoutPassword } = newUser;
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
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
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Reset user password
adminRouter.post('/users/:userId/reset-password', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const { newPassword } = req.body;
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    // Don't allow resetting password of the main admin (ID 1) through this endpoint
    if (userId === 1) {
      return res.status(403).json({ error: 'Cannot reset the password of the primary admin account' });
    }
    
    // Get the current user
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Use our hashPassword function defined at the top of the file
    const hashedPassword = await hashPassword(newPassword);
    
    // Update the user with the new password
    const updatedUser = await storage.updateUser(userId, { 
      password: hashedPassword,
      lastLogin: null // Reset last login to ensure fresh start
    });
    
    if (!updatedUser) {
      return res.status(500).json({ error: 'Failed to update user password' });
    }
    
    // Clear any existing sessions for this user to force fresh login
    try {
      await pool.query('DELETE FROM session WHERE sess->>\'passport\' LIKE $1', [`%"user":${userId}%`]);
    } catch (sessionError) {
      // Don't fail the password reset if session clearing fails
    }
    
    // Return success but don't include the password in the response
    const { password, ...userWithoutPassword } = updatedUser;
    res.json({ 
      ...userWithoutPassword,
      message: 'Password reset successfully. Please login with your new credentials.' 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset user password' });
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
    
    if (!['doctor', 'admin', 'assistant', 'patient', 'administrator'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (role === 'administrator' && (!req.user || req.user.role !== 'administrator')) {
      return res.status(403).json({ error: 'Only global administrators can assign the global administrator role' });
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
    
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
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
        administrator: users.filter(u => u.role === 'administrator').length,
        admin: users.filter(u => u.role === 'admin').length,
        doctor: users.filter(u => u.role === 'doctor').length,
        assistant: users.filter(u => u.role === 'assistant').length,
        patient: users.filter(u => u.role === 'patient').length,
      },
      totalPatients: patients.length,
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
});

// Global API Key Management Routes
adminRouter.get('/global-api-key', async (req: Request, res: Response) => {
  try {
    const globalApiKey = await storage.getSystemSetting('global_openai_api_key');
    // Return masked key for security (only show first 6 chars)
    const maskedKey = globalApiKey ? `${globalApiKey.substring(0, 6)}...` : null;
    res.json({ hasApiKey: !!globalApiKey, maskedKey });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch global API key' });
  }
});

adminRouter.post('/global-api-key', async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body;
    
    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(400).json({ error: 'Valid API key is required' });
    }
    
    // Basic validation for OpenAI API key format
    if (!apiKey.startsWith('sk-') || apiKey.length < 40) {
      return res.status(400).json({ error: 'Invalid OpenAI API key format' });
    }
    
    // Use a default admin user ID if using header authentication
    const userId = req.user?.id || 1; // Default to admin user ID 1
    
    await storage.setSystemSetting('global_openai_api_key', apiKey, 'Global OpenAI API key used for accounts not using their own API key', userId);
    res.json({ success: true, message: 'Global API key updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update global API key' });
  }
});

adminRouter.delete('/global-api-key', async (req: Request, res: Response) => {
  try {
    // Use a default admin user ID if using header authentication
    const userId = req.user?.id || 1; // Default to admin user ID 1
    await storage.setSystemSetting('global_openai_api_key', null, 'Global OpenAI API key used for accounts not using their own API key', userId);
    res.json({ success: true, message: 'Global API key removed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove global API key' });
  }
});

// User API Key Configuration Routes
adminRouter.put('/users/:userId/api-key-setting', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const { useOwnApiKey } = req.body;
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    if (typeof useOwnApiKey !== 'boolean') {
      return res.status(400).json({ error: 'useOwnApiKey must be a boolean value' });
    }
    
    const updatedUser = await storage.updateUserApiKeySettings(userId, useOwnApiKey);
    
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ success: true, message: 'User API key setting updated successfully', user: updatedUser });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user API key setting' });
  }
});

// ==========================================
// GLOBAL PROMPTS MANAGEMENT
// ==========================================

// Helper function to check if global prompts feature is enabled (schema has required columns)
async function isGlobalPromptsEnabled(): Promise<boolean> {
  try {
    const columnCheck = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'custom_note_prompts' AND column_name = 'is_global'
    `);
    return columnCheck.rows.length > 0;
  } catch {
    return false;
  }
}

// Get all global prompts
adminRouter.get('/global-prompts', async (req: Request, res: Response) => {
  try {
    // Check if the feature is enabled (schema has required columns)
    const isEnabled = await isGlobalPromptsEnabled();
    if (!isEnabled) {
      return res.json([]); // Return empty array if feature not enabled
    }
    
    const result = await pool.query(`
      SELECT id, user_id, note_type, name, description, system_prompt, 
             template_content, is_global, is_active, version,
             created_at, updated_at
      FROM custom_note_prompts 
      WHERE is_global = true 
      ORDER BY note_type, id
    `);
    res.json(result.rows);
  } catch (error) {
    res.json([]); // Return empty array on error to allow app to function
  }
});

// Get a single global prompt
adminRouter.get('/global-prompts/:id', async (req: Request, res: Response) => {
  try {
    // Check if the feature is enabled
    const isEnabled = await isGlobalPromptsEnabled();
    if (!isEnabled) {
      return res.status(404).json({ error: 'Global prompts feature not enabled' });
    }
    
    const promptId = parseInt(req.params.id);
    if (isNaN(promptId)) {
      return res.status(400).json({ error: 'Invalid prompt ID' });
    }
    
    const result = await pool.query(`
      SELECT id, user_id, note_type, name, description, system_prompt, 
             template_content, is_global, is_active, version,
             created_at, updated_at
      FROM custom_note_prompts 
      WHERE id = $1 AND is_global = true
    `, [promptId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch global prompt' });
  }
});

// Create a new global prompt
adminRouter.post('/global-prompts', async (req: Request, res: Response) => {
  try {
    // Check if the feature is enabled
    const isEnabled = await isGlobalPromptsEnabled();
    if (!isEnabled) {
      return res.status(400).json({ error: 'Global prompts feature not enabled. Database schema migration required.' });
    }
    
    const { name, description, note_type, system_prompt, template_content, is_active } = req.body;
    
    if (!name || !note_type || !system_prompt) {
      return res.status(400).json({ error: 'Name, note_type, and system_prompt are required' });
    }
    
    const userId = req.user?.id || 1;
    
    const result = await pool.query(`
      INSERT INTO custom_note_prompts 
        (user_id, note_type, name, description, system_prompt, template_content, is_global, is_active, version)
      VALUES ($1, $2, $3, $4, $5, $6, true, $7, '1.0')
      RETURNING *
    `, [userId, note_type, name, description || '', system_prompt, template_content || '', is_active !== false]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create global prompt' });
  }
});

// Update a global prompt
adminRouter.put('/global-prompts/:id', async (req: Request, res: Response) => {
  try {
    // Check if the feature is enabled
    const isEnabled = await isGlobalPromptsEnabled();
    if (!isEnabled) {
      return res.status(400).json({ error: 'Global prompts feature not enabled. Database schema migration required.' });
    }
    
    const promptId = parseInt(req.params.id);
    if (isNaN(promptId)) {
      return res.status(400).json({ error: 'Invalid prompt ID' });
    }
    
    const { name, description, note_type, system_prompt, template_content, is_active } = req.body;
    
    // Increment version
    const currentResult = await pool.query(
      'SELECT version FROM custom_note_prompts WHERE id = $1 AND is_global = true',
      [promptId]
    );
    
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    
    const currentVersion = parseFloat(currentResult.rows[0].version) || 1.0;
    const newVersion = (currentVersion + 0.1).toFixed(1);
    
    const result = await pool.query(`
      UPDATE custom_note_prompts 
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          note_type = COALESCE($3, note_type),
          system_prompt = COALESCE($4, system_prompt),
          template_content = COALESCE($5, template_content),
          is_active = COALESCE($6, is_active),
          version = $7,
          updated_at = NOW()
      WHERE id = $8 AND is_global = true
      RETURNING *
    `, [name, description, note_type, system_prompt, template_content, is_active, newVersion, promptId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update global prompt' });
  }
});

// Toggle prompt active status
adminRouter.patch('/global-prompts/:id/toggle', async (req: Request, res: Response) => {
  try {
    // Check if the feature is enabled
    const isEnabled = await isGlobalPromptsEnabled();
    if (!isEnabled) {
      return res.status(400).json({ error: 'Global prompts feature not enabled. Database schema migration required.' });
    }
    
    const promptId = parseInt(req.params.id);
    if (isNaN(promptId)) {
      return res.status(400).json({ error: 'Invalid prompt ID' });
    }
    
    const { is_active } = req.body;
    
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active must be a boolean' });
    }
    
    const result = await pool.query(`
      UPDATE custom_note_prompts 
      SET is_active = $1, updated_at = NOW()
      WHERE id = $2 AND is_global = true
      RETURNING *
    `, [is_active, promptId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle prompt status' });
  }
});

// Delete a global prompt
adminRouter.delete('/global-prompts/:id', async (req: Request, res: Response) => {
  try {
    // Check if the feature is enabled
    const isEnabled = await isGlobalPromptsEnabled();
    if (!isEnabled) {
      return res.status(400).json({ error: 'Global prompts feature not enabled. Database schema migration required.' });
    }
    
    const promptId = parseInt(req.params.id);
    if (isNaN(promptId)) {
      return res.status(400).json({ error: 'Invalid prompt ID' });
    }
    
    const result = await pool.query(`
      DELETE FROM custom_note_prompts 
      WHERE id = $1 AND is_global = true
      RETURNING id
    `, [promptId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    
    res.json({ success: true, message: 'Prompt deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete global prompt' });
  }
});