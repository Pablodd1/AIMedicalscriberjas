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
  DialogTrigger,
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
  TableCaption,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Check, X, Trash2, UserPlus, UserCog, Shield, Users } from 'lucide-react';

interface User {
  id: number;
  username: string;
  name: string;
  email: string;
  role: 'doctor' | 'admin' | 'assistant' | 'patient';
  isActive: boolean;
  createdAt: string;
  lastLogin: string | null;
}

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  usersByRole: {
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

const AdminPanel = () => {
  const queryClient = useQueryClient();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const adminLoginForm = useForm<z.infer<typeof AdminLoginSchema>>({
    resolver: zodResolver(AdminLoginSchema),
    defaultValues: {
      password: '',
    },
  });

  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['/api/admin/users'],
    queryFn: async () => {
      if (!isAuthenticated) return [] as User[];
      const response = await fetch('/api/admin/users?includePasswords=true', {
        headers: {
          'X-Admin-Password': 'admin@@@'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      return await response.json();
    },
    enabled: isAuthenticated,
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

  const handleAdminLogin = async (data: z.infer<typeof AdminLoginSchema>) => {
    try {
      // First try regular login if the user is already logged in and is an admin
      const userResponse = await fetch('/api/user');
      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (userData.role === 'admin') {
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

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-[350px]">
          <CardHeader>
            <CardTitle>Admin Authentication</CardTitle>
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Admin Panel</h1>
        <Button 
          variant="outline" 
          onClick={() => {
            setIsAuthenticated(false);
            toast({
              title: 'Logged out',
              description: 'You have been logged out of the admin panel.'
            });
          }}
        >
          Logout
        </Button>
      </div>
      
      <Tabs defaultValue="users">
        <TabsList className="mb-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="users">User Management</TabsTrigger>
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
                        {Math.round((stats.usersByRole.doctor / stats.totalUsers) * 100)}% of users
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
                        {Math.round((stats.usersByRole.patient / stats.totalUsers) * 100)}% of users
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-medium">Staff</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {stats.usersByRole.admin + stats.usersByRole.assistant}
                      </div>
                      <div className="flex items-center mt-1 text-sm text-muted-foreground">
                        <div className="flex-1">
                          <span className="font-medium">{stats.usersByRole.admin}</span> admins
                        </div>
                        <div>
                          <span className="font-medium">{stats.usersByRole.assistant}</span> assistants
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
                            <div className="font-mono text-xs truncate max-w-[200px]">
                              {user.password || "No password"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              user.role === 'admin' ? 'destructive' : 
                              user.role === 'doctor' ? 'default' : 
                              user.role === 'assistant' ? 'secondary' : 
                              'outline'
                            }>
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={user.isActive}
                                disabled={user.id === 1} // Cannot change status of main admin
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
                                disabled={user.id === 1} // Cannot edit main admin
                              >
                                <UserCog className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <Button 
                                variant="destructive" 
                                size="sm" 
                                onClick={() => openDeleteDialog(user)}
                                disabled={user.id === 1} // Cannot delete main admin
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
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
      </Tabs>

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
                    <SelectItem value="doctor">Doctor</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
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