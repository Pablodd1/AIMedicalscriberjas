import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Redirect, Link } from "wouter";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { insertUserSchema } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";

// Login schema
const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

// Registration schema - enhanced version of the insertUserSchema
const registerSchema = insertUserSchema.extend({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
  email: z.string().email("Please enter a valid email address"),
  name: z.string().min(1, "Full name is required"),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState("login");
  const { user, loginMutation, registerMutation, bypassLoginMutation, demoLoginMutation } = useAuth();
  const [showDeactivationAlert, setShowDeactivationAlert] = useState(false);
  const allowBypassLogin = import.meta.env.VITE_ENABLE_LOGIN_BYPASS === 'true';
  const [deactivationMessage, setDeactivationMessage] = useState("");
  
  // Login form
  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });
  
  // Register form
  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
      email: "",
      name: "",
      role: "doctor", // Default role
    },
  });
  
  // Handle login submission
  const onLoginSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data, {
      onError: (error: any) => {
        // Check if this is an account deactivation message
        const errorMessage = error?.response?.data?.message || "";
        if (errorMessage.includes("deactivated")) {
          setDeactivationMessage(errorMessage);
          setShowDeactivationAlert(true);
        }
      }
    });
  };
  
  // Handle register submission
  const onRegisterSubmit = (data: RegisterFormData) => {
    // Remove confirmPassword from data before sending to API
    const { confirmPassword, ...registrationData } = data;
    registerMutation.mutate(registrationData);
  };
  
  // If user is already logged in, redirect to dashboard
  if (user) {
    return <Redirect to="/dashboard" />;
  }
  
  return (
    <div className="flex min-h-screen">
      {/* Left side - Auth forms */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Deactivation error message - displayed when account is deactivated */}
          {showDeactivationAlert && (
            <div className="mb-6 p-4 bg-red-500 text-white rounded-md shadow-md">
              <div className="font-bold text-lg mb-1">Login failed</div>
              <div>401: {deactivationMessage}</div>
            </div>
          )}
          <div className="mb-4 flex justify-end">
            <Link href="/">
              <Button variant="outline" size="sm">
                ← Back to Home
              </Button>
            </Link>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Medical Platform</CardTitle>
              <CardDescription>
                Login or register to access your medical dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login">Login</TabsTrigger>
                  <TabsTrigger value="register">Register</TabsTrigger>
                </TabsList>
                
                <TabsContent value="login">
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                      <FormField
                        control={loginForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter your username" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="Enter your password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <Button 
                        type="submit" 
                        className="w-full mt-6" 
                        disabled={loginMutation.isPending}
                      >
                        {loginMutation.isPending ? "Logging in..." : "Login"}
                      </Button>

                      {allowBypassLogin && (
                        <div className="space-y-4">
                          <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                              <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                              <span className="bg-background px-2 text-muted-foreground">
                                Demo Access - Test Different Roles
                              </span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-purple-300 hover:bg-purple-50 hover:border-purple-400"
                              disabled={demoLoginMutation.isPending}
                              onClick={() => demoLoginMutation.mutate({ role: 'administrator' })}
                            >
                              {demoLoginMutation.isPending ? "..." : "👑 Administrator"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-blue-300 hover:bg-blue-50 hover:border-blue-400"
                              disabled={demoLoginMutation.isPending}
                              onClick={() => demoLoginMutation.mutate({ role: 'admin' })}
                            >
                              {demoLoginMutation.isPending ? "..." : "⚙️ Admin"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-green-300 hover:bg-green-50 hover:border-green-400"
                              disabled={demoLoginMutation.isPending}
                              onClick={() => demoLoginMutation.mutate({ role: 'doctor' })}
                            >
                              {demoLoginMutation.isPending ? "..." : "🩺 Doctor"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-yellow-300 hover:bg-yellow-50 hover:border-yellow-400"
                              disabled={demoLoginMutation.isPending}
                              onClick={() => demoLoginMutation.mutate({ role: 'assistant' })}
                            >
                              {demoLoginMutation.isPending ? "..." : "📋 Assistant"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="col-span-2 border-teal-300 hover:bg-teal-50 hover:border-teal-400"
                              disabled={demoLoginMutation.isPending}
                              onClick={() => demoLoginMutation.mutate({ role: 'patient' })}
                            >
                              {demoLoginMutation.isPending ? "..." : "🏥 Patient"}
                            </Button>
                          </div>
                          
                          <Button
                            type="button"
                            variant="ghost"
                            className="w-full text-xs"
                            disabled={bypassLoginMutation.isPending}
                            onClick={() => bypassLoginMutation.mutate()}
                          >
                            {bypassLoginMutation.isPending ? "Connecting..." : "Quick Skip (default role)"}
                          </Button>
                          
                          <p className="text-xs text-muted-foreground text-center">
                            Demo mode for testing access controls. Disable in production.
                          </p>
                        </div>
                      )}
                    </form>
                  </Form>
                </TabsContent>
                
                <TabsContent value="register">
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                      <FormField
                        control={registerForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl>
                              <Input placeholder="John Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={registerForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="email@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={registerForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input placeholder="Choose a username" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={registerForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="Create a password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={registerForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirm Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="Confirm your password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <Button 
                        type="submit" 
                        className="w-full mt-6" 
                        disabled={registerMutation.isPending}
                      >
                        {registerMutation.isPending ? "Creating Account..." : "Register"}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            </CardContent>
            <CardFooter className="flex flex-col space-y-2">
              <p className="text-sm text-muted-foreground text-center">
                {activeTab === "login" 
                  ? "Don't have an account? Click Register above." 
                  : "Already have an account? Click Login above."}
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
      
      {/* Right side - Hero/Information */}
      <div className="hidden lg:flex flex-1 bg-blue-600 text-white p-12 flex-col justify-center">
        <div className="max-w-lg mx-auto">
          <h1 className="text-4xl font-bold mb-6">AI-Powered Medical Platform</h1>
          <p className="text-xl mb-8">
            A comprehensive healthcare solution designed for medical professionals to streamline patient management, telemedicine, and medical documentation.
          </p>
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="rounded-full bg-blue-500 p-2 mr-4">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Advanced Patient Management</h3>
                <p>Effortlessly organize and access patient records, medical history, and appointments.</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="rounded-full bg-blue-500 p-2 mr-4">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Secure Telemedicine</h3>
                <p>Conduct virtual consultations with patients securely and efficiently.</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="rounded-full bg-blue-500 p-2 mr-4">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-lg">AI-Powered Documentation</h3>
                <p>Generate accurate medical notes and documentation using advanced AI technology.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}