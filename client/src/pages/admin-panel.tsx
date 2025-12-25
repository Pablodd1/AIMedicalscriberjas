import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Check, X, Trash2, UserPlus, UserCog, Shield, Users, Key, AlertCircle, CheckCircle, ShieldAlert, FileText } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Link } from 'wouter';

interface User {
  id: number;
  username: string;
  name: string;
  email: string;
  role: 'doctor' | 'admin' | 'assistant' | 'patient' | 'administrator';
  isActive: boolean;
  useOwnApiKey: boolean;
  createdAt: string;
  lastLogin: string | null;
}

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  usersByRole: {
    administrator: number;
    admin: number;
    doctor: number;
    assistant: number;
    patient: number;
  };
  totalPatients: number;
}

const AdminLoginSchema = z.object({
  password: z.string().min(1, { message: 'Password is required' }),
});

const ROLE_VALUES = ['administrator', 'admin', 'doctor', 'assistant', 'patient'] as const;
type RoleValue = typeof ROLE_VALUES[number];

const ROLE_LABELS: Record<RoleValue, string> = {
  administrator: 'Global Administrator',
  admin: 'Admin',
  doctor: 'Doctor / Provider',
  assistant: 'Assistant',
  patient: 'Patient',
};

const ROLE_BADGE_VARIANTS: Record<RoleValue, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  administrator: 'destructive',
  admin: 'destructive',
  doctor: 'default',
  assistant: 'secondary',
  patient: 'outline',
};

const ROLE_OPTIONS: Array<{
  value: RoleValue;
  label: string;
  description: string;
  requiresGlobalAdmin?: boolean;
}> = [
    {
      value: 'administrator',
      label: ROLE_LABELS.administrator,
      description: 'Full platform ownership. Manage admins, billing, and system-wide settings.',
      requiresGlobalAdmin: true,
    },
    {
      value: 'admin',
      label: ROLE_LABELS.admin,
      description: 'Clinic administrator with access to user management, billing, and settings.',
    },
    {
      value: 'doctor',
      label: ROLE_LABELS.doctor,
      description: 'Primary provider access for patient care, telemedicine, and documentation.',
    },
    {
      value: 'assistant',
      label: ROLE_LABELS.assistant,
      description: 'Support staff access for scheduling, documentation support, and communications.',
    },
    {
      value: 'patient',
      label: ROLE_LABELS.patient,
      description: 'Patient portal access.',
    },
  ];

const CreateUserSchema = z
  .object({
    name: z.string().min(1, { message: 'Name is required' }),
    email: z.string().email({ message: 'Valid email is required' }),
    username: z.string().min(3, { message: 'Username must be at least 3 characters' }),
    password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
    confirmPassword: z.string().min(1, { message: 'Please confirm the password' }),
    role: z.enum(ROLE_VALUES).default('doctor'),
    phone: z.string().optional(),
    specialty: z.string().optional(),
    licenseNumber: z.string().optional(),
    isActive: z.boolean().default(true),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords must match',
  });

type CreateUserFormValues = z.infer<typeof CreateUserSchema>;
type CreateUserPayload = Omit<CreateUserFormValues, 'confirmPassword'>;

const AdminPanel = () => {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);

  // Auto-authenticate if user is admin
  useEffect(() => {
    if (currentUser && ['admin', 'administrator'].includes(currentUser.role)) {
      setIsAuthenticated(true);
    }
  }, [currentUser]);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [globalApiKey, setGlobalApiKey] = useState('');
  const [selectedUserForApiKey, setSelectedUserForApiKey] = useState<User | null>(null);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [tempApiKeySetting, setTempApiKeySetting] = useState<boolean>(false);

  const adminLoginForm = useForm<z.infer<typeof AdminLoginSchema>>({
    resolver: zodResolver(AdminLoginSchema),
    defaultValues: {
      password: '',
    },
  });

  const createUserForm = useForm<CreateUserFormValues>({
    resolver: zodResolver(CreateUserSchema),
    defaultValues: {
      name: '',
      email: '',
      username: '',
      password: '',
      confirmPassword: '',
      role: 'doctor',
      phone: '',
      specialty: '',
      licenseNumber: '',
      isActive: true,
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (payload: CreateUserPayload) => {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': 'admin@@@',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || data?.message || 'Failed to create user');
      }

      return data as UserWithPlainPassword;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard'] });
      setShowCreateUserDialog(false);
      createUserForm.reset({
        name: '',
        email: '',
        username: '',
        password: '',
        confirmPassword: '',
        role: 'doctor',
        phone: '',
        specialty: '',
        licenseNumber: '',
        isActive: true,
      });
      toast({
        title: 'User created',
        description: `Account for ${data.name} created successfully.${data.plain_password ? ` Temporary password: ${data.plain_password}` : ''}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create user',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleCreateUserSubmit = createUserForm.handleSubmit((values) => {
    const { confirmPassword, ...rest } = values;
    const payload: CreateUserPayload = {
      ...rest,
      name: rest.name.trim(),
      email: rest.email.trim(),
      username: rest.username.trim(),
      password: rest.password,
      phone: rest.phone?.trim() ? rest.phone.trim() : undefined,
      specialty: rest.specialty?.trim() ? rest.specialty.trim() : undefined,
      licenseNumber: rest.licenseNumber?.trim() ? rest.licenseNumber.trim() : undefined,
      isActive: rest.isActive ?? true,
    };

    createUserMutation.mutate(payload);
  });

  interface UserWithPlainPassword extends User {
    plain_password?: string;
    password?: string;
  }

  const { data: users, isLoading: isLoadingUsers } = useQuery<UserWithPlainPassword[]>({
    queryKey: ['/api/admin/users'],
    queryFn: async () => {
      if (!isAuthenticated) return [] as UserWithPlainPassword[];
      const response = await fetch('/api/admin/users?includePasswords=true&_t=' + Date.now(), {
        headers: {
          'X-Admin-Password': 'admin@@@',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      return await response.json();
    },
    enabled: isAuthenticated,
    staleTime: 0,
    gcTime: 0,
  });

  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['/api/admin/dashboard'],
    queryFn: async () => {
      if (!isAuthenticated) return null;
      const response = await fetch('/api/admin/dashboard', {
        headers: {
          'X-Admin-Password': 'admin@@@'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      return await response.json();
    },
    enabled: isAuthenticated,
  });

  // API key management queries
  const { data: globalApiKeyData, isLoading: isLoadingGlobalApiKey } = useQuery({
    queryKey: ['/api/admin/global-api-key'],
    queryFn: async () => {
      if (!isAuthenticated) return null;
      const response = await fetch('/api/admin/global-api-key', {
        headers: {
          'X-Admin-Password': 'admin@@@'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch global API key');
      }
      return await response.json();
    },
    enabled: isAuthenticated,
  });

  const updateUserStatusMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: number; isActive: boolean }) => {
      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': 'admin@@@'
        },
        body: JSON.stringify({ isActive }),
      });
      if (!response.ok) {
        throw new Error('Failed to update user status');
      }
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard'] });
      toast({
        title: 'User status updated',
        description: 'The user status has been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error updating user status',
        description: 'There was an error updating the user status. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': 'admin@@@'
        },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) {
        throw new Error('Failed to update user role');
      }
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard'] });
      setShowEditDialog(false);
      toast({
        title: 'User role updated',
        description: 'The user role has been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error updating user role',
        description: 'There was an error updating the user role. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: number; password: string }) => {
      const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': 'admin@@@'
        },
        body: JSON.stringify({ newPassword: password }),
      });
      if (!response.ok) {
        throw new Error('Failed to reset password');
      }
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setShowResetPasswordDialog(false);
      setNewPassword('');
      toast({
        title: 'Password reset successful',
        description: 'The user password has been reset.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error resetting password',
        description: 'There was an error resetting the password. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'X-Admin-Password': 'admin@@@'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to delete user');
      }
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard'] });
      setShowDeleteDialog(false);
      toast({
        title: 'User deleted',
        description: 'The user has been deleted successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error deleting user',
        description: 'There was an error deleting the user. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // API key mutations
  const saveGlobalApiKeyMutation = useMutation({
    mutationFn: async (apiKey: string) => {
      const response = await fetch('/api/admin/global-api-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': 'admin@@@'
        },
        body: JSON.stringify({ apiKey }),
      });
      if (!response.ok) {
        throw new Error('Failed to save global API key');
      }
      return await response.json();
    },
    onSuccess: () => {
      forceRefreshData();
      setGlobalApiKey('');
      toast({
        title: 'Global API key saved',
        description: 'The global OpenAI API key has been saved successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error saving API key',
        description: 'There was an error saving the global API key. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const deleteGlobalApiKeyMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/global-api-key', {
        method: 'DELETE',
        headers: {
          'X-Admin-Password': 'admin@@@'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to delete global API key');
      }
      return await response.json();
    },
    onSuccess: () => {
      forceRefreshData();
      setGlobalApiKey('');
      toast({
        title: 'Global API key removed',
        description: 'The global OpenAI API key has been removed successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error removing API key',
        description: 'There was an error removing the global API key. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const updateUserApiKeySettingMutation = useMutation({
    mutationFn: async ({ userId, useOwnApiKey }: { userId: number; useOwnApiKey: boolean }) => {
      const response = await fetch(`/api/admin/users/${userId}/api-key-setting`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': 'admin@@@'
        },
        body: JSON.stringify({ useOwnApiKey }),
      });
      if (!response.ok) {
        throw new Error('Failed to update user API key setting');
      }
      return await response.json();
    },
    onSuccess: (data) => {
      // Update the selectedUserForApiKey immediately with the new state
      if (selectedUserForApiKey && data.user) {
        setSelectedUserForApiKey(data.user);
      }

      // Confirm the cache data is correct - no need to refresh since we already updated optimistically
      queryClient.setQueryData(['/api/admin/users'], (oldData: UserWithPlainPassword[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map(user =>
          user.id === data.user.id
            ? { ...user, useOwnApiKey: data.user.useOwnApiKey }
            : user
        );
      });

      setShowApiKeyDialog(false);
      setTempApiKeySetting(false); // Reset temp state
      toast({
        title: 'API key setting updated',
        description: 'The user API key setting has been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error updating API key setting',
        description: 'There was an error updating the API key setting. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleAdminLogin = async (data: z.infer<typeof AdminLoginSchema>) => {
    try {
      // First try regular login if the user is already logged in and is an admin
      const userResponse = await fetch('/api/user');
      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (['admin', 'administrator'].includes(userData.role)) {
          setIsAuthenticated(true);
          toast({
            title: 'Authentication successful',
            description: 'You are now authenticated as an admin.',
          });
          return;
        }
      }

      // Alternative password-based login for direct admin access
      if (data.password === 'admin@@@') {
        setIsAuthenticated(true);
        toast({
          title: 'Authentication successful',
          description: 'You are now authenticated as an admin using direct access.',
        });
      } else {
        toast({
          title: 'Authentication failed',
          description: 'The password you entered is incorrect.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Authentication error',
        description: 'There was an error during authentication.',
        variant: 'destructive',
      });
    }
  };

  const handleUserStatusToggle = (userId: number, isActive: boolean) => {
    updateUserStatusMutation.mutate({ userId, isActive: !isActive });
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setShowEditDialog(true);
  };

  const openDeleteDialog = (user: User) => {
    setSelectedUser(user);
    setShowDeleteDialog(true);
  };

  const openResetPasswordDialog = (user: User) => {
    setSelectedUser(user);
    setNewPassword('');
    setShowResetPasswordDialog(true);
  };

  const handleResetPassword = () => {
    if (selectedUser && newPassword.length >= 6) {
      resetPasswordMutation.mutate({
        userId: selectedUser.id,
        password: newPassword
      });
    } else {
      toast({
        title: 'Invalid password',
        description: 'Password must be at least 6 characters long.',
        variant: 'destructive',
      });
    }
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (selectedUser) {
      updateUserRoleMutation.mutate({
        userId: selectedUser.id,
        role: e.target.value,
      });
    }
  };

  const handleDeleteUser = () => {
    if (selectedUser) {
      deleteUserMutation.mutate(selectedUser.id);
    }
  };

  // API key handlers
  const handleSaveGlobalApiKey = () => {
    if (globalApiKey.trim()) {
      saveGlobalApiKeyMutation.mutate(globalApiKey);
    }
  };

  const handleDeleteGlobalApiKey = () => {
    deleteGlobalApiKeyMutation.mutate();
  };

  const openApiKeyDialog = (user: User) => {
    setSelectedUserForApiKey(user);
    setTempApiKeySetting(Boolean(user.useOwnApiKey)); // Ensure we have a boolean value
    setShowApiKeyDialog(true);
  };

  // Force refresh helper
  const forceRefreshData = () => {
    queryClient.removeQueries({ queryKey: ['/api/admin/users'] });
    queryClient.removeQueries({ queryKey: ['/api/admin/global-api-key'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/global-api-key'] });
    queryClient.refetchQueries({ queryKey: ['/api/admin/users'] });
    queryClient.refetchQueries({ queryKey: ['/api/admin/global-api-key'] });
  };

  const handleUpdateUserApiKeySetting = (useOwnApiKey: boolean) => {
    if (selectedUserForApiKey) {
      setTempApiKeySetting(useOwnApiKey); // Optimistic update for UI

      // Immediately update the cache with the new setting
      queryClient.setQueryData(['/api/admin/users'], (oldData: UserWithPlainPassword[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map(user =>
          user.id === selectedUserForApiKey.id
            ? { ...user, useOwnApiKey }
            : user
        );
      });

      updateUserApiKeySettingMutation.mutate({
        userId: selectedUserForApiKey.id,
        useOwnApiKey
      });
    }
  };

  // Show access denied for non-admin users
  if (currentUser && !['admin', 'administrator'].includes(currentUser.role) && !isAuthenticated) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-destructive" />
              <CardTitle>Access Denied</CardTitle>
            </div>
            <CardDescription>
              You don't have permission to access the Admin Panel.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Only users with the <Badge variant="destructive">admin</Badge> or <Badge variant="destructive">administrator</Badge> roles can access this page.
            </p>
            <p className="text-sm text-muted-foreground">
              Your current role: <Badge variant="secondary">{currentUser.role}</Badge>
            </p>
          </CardContent>
          <CardFooter>
            <Link href="/dashboard">
              <Button className="w-full">Return to Dashboard</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6" />
              <CardTitle>Admin Authentication</CardTitle>
            </div>
            <CardDescription>
              Enter the admin password to access the admin panel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...adminLoginForm}>
              <form onSubmit={adminLoginForm.handleSubmit(handleAdminLogin)} className="space-y-4">
                <FormField
                  control={adminLoginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter admin password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full">
                  Log In
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Admin Panel
          </h1>
          <p className="text-muted-foreground mt-1">Manage users, API keys, and system settings</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => setShowCreateUserDialog(true)}
            disabled={createUserMutation.isPending}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Add User
          </Button>
          <Link href="/admin/prompts">
            <Button variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-2" />
              Global Prompts
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={forceRefreshData}
          >
            Refresh Data
          </Button>
          {(!currentUser || !['admin', 'administrator'].includes(currentUser.role)) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsAuthenticated(false);
                toast({
                  title: 'Logged out',
                  description: 'You have been logged out of the admin panel.'
                });
              }}
            >
              Logout Admin
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="mb-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="api-keys">API Key Management</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <Card>
            <CardHeader>
              <CardTitle>System Dashboard</CardTitle>
              <CardDescription>
                Overview of system statistics and user information.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : stats ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-medium">Total Users</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.totalUsers}</div>
                      <div className="flex items-center mt-1 text-sm text-muted-foreground">
                        <div className="flex-1">
                          <span className="text-green-500 font-medium">{stats.activeUsers}</span> active
                        </div>
                        <div>
                          <span className="text-red-500 font-medium">{stats.inactiveUsers}</span> inactive
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-medium">Doctors</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.usersByRole.doctor}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {stats.totalUsers ? Math.round((stats.usersByRole.doctor / stats.totalUsers) * 100) : 0}% of users
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-medium">Patients</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.usersByRole.patient}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {stats.totalUsers ? Math.round((stats.usersByRole.patient / stats.totalUsers) * 100) : 0}% of users
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-medium">Admin &amp; Support</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {stats.usersByRole.administrator + stats.usersByRole.admin + stats.usersByRole.assistant}
                      </div>
                      <div className="space-y-1 mt-2 text-sm text-muted-foreground">
                        <div className="flex items-center justify-between">
                          <span>Global administrators</span>
                          <span className="font-medium">{stats.usersByRole.administrator}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Admins</span>
                          <span className="font-medium">{stats.usersByRole.admin}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Assistants</span>
                          <span className="font-medium">{stats.usersByRole.assistant}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Failed to load dashboard statistics
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Manage user accounts, permissions, and status.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingUsers ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : users && users.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Password</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-muted-foreground">@{user.username}</div>
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <div className="font-mono text-sm truncate max-w-[200px]">
                              {user.plain_password ?? '—'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={ROLE_BADGE_VARIANTS[user.role as RoleValue]}>
                              {ROLE_LABELS[user.role as RoleValue]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={user.isActive}
                                disabled={
                                  user.id === 1 ||
                                  (user.role === 'administrator' && currentUser?.role !== 'administrator')
                                }
                                onCheckedChange={() => handleUserStatusToggle(user.id, user.isActive)}
                              />
                              <span className={user.isActive ? 'text-green-600' : 'text-red-600'}>
                                {user.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditDialog(user)}
                                disabled={user.id === 1 || (user.role === 'administrator' && currentUser?.role !== 'administrator')}
                              >
                                <UserCog className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => openDeleteDialog(user)}
                                disabled={user.id === 1 || (user.role === 'administrator' && currentUser?.role !== 'administrator')}
                                className="mr-1"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openResetPasswordDialog(user)}
                                disabled={user.id === 1 || (user.role === 'administrator' && currentUser?.role !== 'administrator')}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-1"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                Reset
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No users found
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api-keys">
          <div className="space-y-6">
            {/* Global API Key Management */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Global OpenAI API Key
                </CardTitle>
                <CardDescription>
                  Configure the global OpenAI API key that will be used by default for all AI features.
                  This key will be used for users who don't have their own personal API key configured.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingGlobalApiKey ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {globalApiKeyData?.hasApiKey && (
                      <Alert>
                        <CheckCircle className="h-4 w-4" />
                        <AlertDescription>
                          <div className="flex items-center justify-between">
                            <span>Global API key configured: <strong>{globalApiKeyData.maskedKey}</strong></span>
                            <Badge variant="secondary" className="ml-2">Active</Badge>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">
                          {globalApiKeyData?.hasApiKey ? 'Update API Key' : 'Set Global API Key'}
                        </label>
                        {globalApiKeyData?.hasApiKey && (
                          <span className="text-xs text-muted-foreground">
                            Current: {globalApiKeyData.maskedKey}
                          </span>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <Input
                          placeholder={globalApiKeyData?.hasApiKey ? "Enter new API key to update existing one" : "sk-..."}
                          type="password"
                          value={globalApiKey}
                          onChange={(e) => setGlobalApiKey(e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          onClick={handleSaveGlobalApiKey}
                          disabled={saveGlobalApiKeyMutation.isPending || !globalApiKey.trim()}
                        >
                          {saveGlobalApiKeyMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : null}
                          {globalApiKeyData?.hasApiKey ? 'Update' : 'Save'}
                        </Button>
                        {globalApiKeyData?.hasApiKey && (
                          <Button
                            variant="destructive"
                            onClick={handleDeleteGlobalApiKey}
                            disabled={deleteGlobalApiKeyMutation.isPending}
                          >
                            {deleteGlobalApiKeyMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="text-sm text-muted-foreground">
                      <h4 className="font-medium mb-2">Important Notes:</h4>
                      <ul className="list-disc list-inside space-y-1">
                        <li>This key will be used for all users who don't have their own personal API key</li>
                        <li>API usage will be charged to the account associated with this key</li>
                        <li>You can configure each user to use either this global key or their own personal key</li>
                        <li>Get your API key from the <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">OpenAI Platform</a></li>
                      </ul>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* User API Key Settings */}
            <Card>
              <CardHeader>
                <CardTitle>User API Key Settings</CardTitle>
                <CardDescription>
                  Configure which users can use their own personal OpenAI API keys vs. the global API key.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingUsers ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : users && users.length > 0 ? (
                  <div className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>API Key Source</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{user.name}</div>
                                <div className="text-sm text-muted-foreground">@{user.username}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={ROLE_BADGE_VARIANTS[user.role as RoleValue]}>
                                {ROLE_LABELS[user.role as RoleValue]}
                              </Badge>
                            </TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              <Badge variant={user.useOwnApiKey ? 'outline' : 'secondary'}>
                                {user.useOwnApiKey ? 'Personal API Key' : 'Global API Key'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openApiKeyDialog(user)}
                              >
                                <Key className="h-4 w-4 mr-1" />
                                Configure
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No users found
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create User Dialog */}
      <Dialog
        open={showCreateUserDialog}
        onOpenChange={(open) => {
          setShowCreateUserDialog(open);
          if (!open && !createUserMutation.isPending) {
            createUserForm.reset({
              name: '',
              email: '',
              username: '',
              password: '',
              confirmPassword: '',
              role: 'doctor',
              phone: '',
              specialty: '',
              licenseNumber: '',
              isActive: true,
            });
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Account</DialogTitle>
            <DialogDescription>
              Provision a new provider, administrator, or staff account. Temporary credentials will be shown once created.
            </DialogDescription>
          </DialogHeader>

          <Form {...createUserForm}>
            <form onSubmit={handleCreateUserSubmit} className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={createUserForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full name</FormLabel>
                      <FormControl>
                        <Input placeholder="Dr. Alicia Gomez" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createUserForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="provider@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createUserForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="provider" {...field} />
                      </FormControl>
                      <FormDescription>This is used for login. Minimum 3 characters.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createUserForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ROLE_OPTIONS.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value}
                              disabled={option.requiresGlobalAdmin && currentUser?.role !== 'administrator'}
                            >
                              <div className="flex flex-col">
                                <span>{option.label}</span>
                                <span className="text-xs text-muted-foreground">{option.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={createUserForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Temporary password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="At least 8 characters" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createUserForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Re-enter password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={createUserForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="(555) 555-5555" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createUserForm.control}
                  name="specialty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Specialty (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Internal Medicine" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createUserForm.control}
                  name="licenseNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>License number (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="MD-12345" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={createUserForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-1">
                      <FormLabel>Activate immediately</FormLabel>
                      <FormDescription>Active users can log in right away. Toggle off to require approval first.</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateUserDialog(false);
                    if (!createUserMutation.isPending) {
                      createUserForm.reset({
                        name: '',
                        email: '',
                        username: '',
                        password: '',
                        confirmPassword: '',
                        role: 'doctor',
                        phone: '',
                        specialty: '',
                        licenseNumber: '',
                        isActive: true,
                      });
                    }
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createUserMutation.isPending}>
                  {createUserMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </span>
                  ) : (
                    'Create user'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* API Key Setting Dialog */}
      <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure API Key Setting</DialogTitle>
            <DialogDescription>
              Choose the API key source for {selectedUserForApiKey?.name} ({selectedUserForApiKey?.username}).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="global-key"
                  name="apiKeySource"
                  checked={tempApiKeySetting === false}
                  onChange={() => handleUpdateUserApiKeySetting(false)}
                  className="h-4 w-4"
                  disabled={updateUserApiKeySettingMutation.isPending}
                />
                <Label htmlFor="global-key" className="text-sm">
                  Use Global API Key
                  {updateUserApiKeySettingMutation.isPending && tempApiKeySetting === false && (
                    <Loader2 className="h-3 w-3 animate-spin ml-1 inline" />
                  )}
                </Label>
              </div>
              <p className="text-xs text-muted-foreground ml-6">
                The user will use the system's global OpenAI API key for all AI features.
              </p>

              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="personal-key"
                  name="apiKeySource"
                  checked={tempApiKeySetting === true}
                  onChange={() => handleUpdateUserApiKeySetting(true)}
                  className="h-4 w-4"
                  disabled={updateUserApiKeySettingMutation.isPending}
                />
                <Label htmlFor="personal-key" className="text-sm">
                  Allow Personal API Key
                  {updateUserApiKeySettingMutation.isPending && tempApiKeySetting === true && (
                    <Loader2 className="h-3 w-3 animate-spin ml-1 inline" />
                  )}
                </Label>
              </div>
              <p className="text-xs text-muted-foreground ml-6">
                The user can configure their own OpenAI API key in their settings page. If no personal key is set, the global key will be used as fallback.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowApiKeyDialog(false);
                setTempApiKeySetting(false);
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={showResetPasswordDialog} onOpenChange={setShowResetPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Enter a new password for {selectedUser?.name} ({selectedUser?.username}).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 characters)"
              />
              <p className="text-xs text-muted-foreground">
                Password must be at least 6 characters long.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowResetPasswordDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={resetPasswordMutation.isPending || !newPassword || newPassword.length < 6}
            >
              {resetPasswordMutation.isPending ? (
                <>
                  <span className="mr-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </span>
                  Resetting...
                </>
              ) : (
                'Reset Password'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user role and permissions.
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="userName">Name</Label>
                <Input id="userName" value={selectedUser.name} disabled />
              </div>

              <div>
                <Label htmlFor="userEmail">Email</Label>
                <Input id="userEmail" value={selectedUser.email} disabled />
              </div>

              <div>
                <Label htmlFor="userRole">Role</Label>
                <Select defaultValue={selectedUser.role} onValueChange={(value) => {
                  if (selectedUser) {
                    updateUserRoleMutation.mutate({
                      userId: selectedUser.id,
                      role: value
                    });
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="administrator">Global Administrator</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="doctor">Doctor</SelectItem>
                    <SelectItem value="assistant">Assistant</SelectItem>
                    <SelectItem value="patient">Patient</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="user-active"
                  checked={selectedUser.isActive}
                  onCheckedChange={(checked) => {
                    updateUserStatusMutation.mutate({
                      userId: selectedUser.id,
                      isActive: checked
                    });
                  }}
                />
                <Label htmlFor="user-active">
                  {selectedUser.isActive ? 'User is active' : 'User is inactive'}
                </Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowEditDialog(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user account
              and remove their data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminPanel;