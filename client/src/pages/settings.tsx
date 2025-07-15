import React, { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Key, AlertCircle, CheckCircle } from "lucide-react";

// Email settings form schema
const emailSettingsSchema = z.object({
  senderEmail: z.string().email({ message: "Invalid email address" }),
  senderName: z.string().min(2, { message: "Sender name is required" }),
  appPassword: z.string().min(1, { message: "App password is required" }),
});

// Email template form schema
const emailTemplateSchema = z.object({
  appointmentConfirmation: z.string().min(10, { message: "Template content is required" }),
  appointmentReminder: z.string().min(10, { message: "Template content is required" }),
  appointmentCancellation: z.string().min(10, { message: "Template content is required" }),
  appointmentRescheduled: z.string().min(10, { message: "Template content is required" }),
});

// API key form schema
const apiKeySchema = z.object({
  apiKey: z.string().min(40, { message: "OpenAI API key is required" }).startsWith("sk-", { message: "Invalid OpenAI API key format" }),
});

type EmailSettingsFormValues = z.infer<typeof emailSettingsSchema>;
type EmailTemplateFormValues = z.infer<typeof emailTemplateSchema>;
type ApiKeyFormValues = z.infer<typeof apiKeySchema>;

export default function Settings() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("general");

  // Email settings form
  const emailSettingsForm = useForm<EmailSettingsFormValues>({
    resolver: zodResolver(emailSettingsSchema),
    defaultValues: {
      senderEmail: "",
      senderName: "",
      appPassword: "",
    }
  });

  // Email template form
  const emailTemplateForm = useForm<EmailTemplateFormValues>({
    resolver: zodResolver(emailTemplateSchema),
    defaultValues: {
      appointmentConfirmation: "Dear {{patientName}},\n\nThis is to confirm your appointment scheduled for {{appointmentDate}} at {{appointmentTime}}.\n\nRegards,\n{{doctorName}}",
      appointmentReminder: "Dear {{patientName}},\n\nThis is a reminder of your upcoming appointment on {{appointmentDate}} at {{appointmentTime}}.\n\nRegards,\n{{doctorName}}",
      appointmentCancellation: "Dear {{patientName}},\n\nYour appointment scheduled for {{appointmentDate}} at {{appointmentTime}} has been cancelled.\n\nRegards,\n{{doctorName}}",
      appointmentRescheduled: "Dear {{patientName}},\n\nYour appointment has been rescheduled to {{appointmentDate}} at {{appointmentTime}}.\n\nRegards,\n{{doctorName}}",
    }
  });

  // API key form
  const apiKeyForm = useForm<ApiKeyFormValues>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: {
      apiKey: "",
    }
  });

  // Fetch existing settings
  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["/api/settings/email"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/settings/email");
        const data = await res.json();
        if (data) {
          emailSettingsForm.reset({
            senderEmail: data.senderEmail || "",
            senderName: data.senderName || "",
            appPassword: data.appPassword || "",
          });
        }
        return data;
      } catch (error) {
        // If settings don't exist yet, just use defaults
        return null;
      }
    },
    // Don't show error if settings don't exist yet
    retry: false,
  });

  // Fetch email templates
  const { data: templates, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ["/api/settings/email-templates"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/settings/email-templates");
        const data = await res.json();
        if (data) {
          emailTemplateForm.reset({
            appointmentConfirmation: data.appointmentConfirmation || emailTemplateForm.getValues().appointmentConfirmation,
            appointmentReminder: data.appointmentReminder || emailTemplateForm.getValues().appointmentReminder,
            appointmentCancellation: data.appointmentCancellation || emailTemplateForm.getValues().appointmentCancellation,
            appointmentRescheduled: data.appointmentRescheduled || emailTemplateForm.getValues().appointmentRescheduled,
          });
        }
        return data;
      } catch (error) {
        // If templates don't exist yet, just use defaults
        return null;
      }
    },
    // Don't show error if templates don't exist yet
    retry: false,
  });

  // Fetch API key settings
  const { data: apiKeyData, isLoading: isLoadingApiKey } = useQuery({
    queryKey: ["/api/user/api-key"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/user/api-key");
      return res.json();
    },
  });

  // Save email settings
  const saveEmailSettingsMutation = useMutation({
    mutationFn: async (data: EmailSettingsFormValues) => {
      const res = await apiRequest("POST", "/api/settings/email", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/email"] });
      toast({
        title: "Success",
        description: "Email settings have been saved",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Save email templates
  const saveEmailTemplatesMutation = useMutation({
    mutationFn: async (data: EmailTemplateFormValues) => {
      const res = await apiRequest("POST", "/api/settings/email-templates", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/email-templates"] });
      toast({
        title: "Success",
        description: "Email templates have been saved",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save templates",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Save API key
  const saveApiKeyMutation = useMutation({
    mutationFn: async (data: ApiKeyFormValues) => {
      const response = await fetch('/api/user/api-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to save API key');
      }
      
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/api-key"] });
      apiKeyForm.reset({ apiKey: "" });
      toast({
        title: "Success",
        description: data.message || "OpenAI API key has been saved",
      });
    },
    onError: (error: Error) => {
      console.error('API Key save error:', error);
      toast({
        title: "Failed to save API key",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete API key
  const deleteApiKeyMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/user/api-key', {
        method: 'DELETE',
        credentials: 'include',
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to remove API key');
      }
      
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/api-key"] });
      toast({
        title: "Success",
        description: data.message || "OpenAI API key has been removed",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to remove API key",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Submit handlers
  const onSubmitEmailSettings = (data: EmailSettingsFormValues) => {
    saveEmailSettingsMutation.mutate(data);
  };

  const onSubmitEmailTemplates = (data: EmailTemplateFormValues) => {
    saveEmailTemplatesMutation.mutate(data);
  };

  const onSubmitApiKey = (data: ApiKeyFormValues) => {
    saveApiKeyMutation.mutate(data);
  };

  const handleDeleteApiKey = () => {
    deleteApiKeyMutation.mutate();
  };

  // Test email handler
  const sendTestEmailMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/settings/test-email", {
        testEmail: emailSettingsForm.getValues().senderEmail, // Send to self for testing
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Test email sent",
        description: "Check your inbox to verify email configuration",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send test email",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSendTestEmail = () => {
    sendTestEmailMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>

      <Tabs defaultValue="general" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="general">Email Configuration</TabsTrigger>
          <TabsTrigger value="templates">Email Templates</TabsTrigger>
          <TabsTrigger value="api-key">OpenAI API Key</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Settings</CardTitle>
              <CardDescription>Configure your email sending settings. These are required for sending notifications to patients.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...emailSettingsForm}>
                <form onSubmit={emailSettingsForm.handleSubmit(onSubmitEmailSettings)} className="space-y-6">
                  <FormField
                    control={emailSettingsForm.control}
                    name="senderEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sender Email</FormLabel>
                        <FormControl>
                          <Input placeholder="office@example.com" {...field} />
                        </FormControl>
                        <FormDescription>
                          This email will be used as the sender for all outgoing emails.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={emailSettingsForm.control}
                    name="senderName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sender Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Dr. John Smith's Office" {...field} />
                        </FormControl>
                        <FormDescription>
                          This name will appear as the sender of all outgoing emails.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={emailSettingsForm.control}
                    name="appPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>App Password</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Your app password" 
                            type="password" 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Enter the app password for your email account. For Gmail, generate an App Password in your Google Account security settings.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex space-x-2">
                    <Button 
                      type="submit" 
                      disabled={saveEmailSettingsMutation.isPending || !emailSettingsForm.formState.isDirty}
                    >
                      {saveEmailSettingsMutation.isPending ? "Saving..." : "Save Settings"}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleSendTestEmail}
                      disabled={sendTestEmailMutation.isPending || 
                        !emailSettingsForm.getValues().senderEmail || 
                        !emailSettingsForm.getValues().appPassword}
                    >
                      {sendTestEmailMutation.isPending ? "Sending..." : "Send Test Email"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="templates" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Templates</CardTitle>
              <CardDescription>Customize the email templates sent to patients. Use the placeholders in double curly braces.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...emailTemplateForm}>
                <form onSubmit={emailTemplateForm.handleSubmit(onSubmitEmailTemplates)} className="space-y-6">
                  <FormField
                    control={emailTemplateForm.control}
                    name="appointmentConfirmation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Appointment Confirmation</FormLabel>
                        <FormControl>
                          <Textarea className="min-h-[120px]" {...field} />
                        </FormControl>
                        <FormDescription>
                          Sent when an appointment is initially scheduled.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={emailTemplateForm.control}
                    name="appointmentReminder"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Appointment Reminder</FormLabel>
                        <FormControl>
                          <Textarea className="min-h-[120px]" {...field} />
                        </FormControl>
                        <FormDescription>
                          Sent as a reminder before an upcoming appointment.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={emailTemplateForm.control}
                    name="appointmentCancellation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Appointment Cancellation</FormLabel>
                        <FormControl>
                          <Textarea className="min-h-[120px]" {...field} />
                        </FormControl>
                        <FormDescription>
                          Sent when an appointment is cancelled.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={emailTemplateForm.control}
                    name="appointmentRescheduled"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Appointment Rescheduled</FormLabel>
                        <FormControl>
                          <Textarea className="min-h-[120px]" {...field} />
                        </FormControl>
                        <FormDescription>
                          Sent when an appointment is rescheduled.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    disabled={saveEmailTemplatesMutation.isPending || !emailTemplateForm.formState.isDirty}
                  >
                    {saveEmailTemplatesMutation.isPending ? "Saving..." : "Save Templates"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api-key" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                OpenAI API Key Management
              </CardTitle>
              <CardDescription>
                Manage your personal OpenAI API key for AI-powered features like medical note generation and AI assistant.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoadingApiKey ? (
                <div>Loading API key settings...</div>
              ) : !apiKeyData?.canUseOwnApiKey ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {apiKeyData?.message || "Your account is not configured to use personal API keys. Contact your administrator to enable this feature."}
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-6">
                  {apiKeyData?.hasApiKey && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        API key configured: {apiKeyData.maskedKey}
                      </AlertDescription>
                    </Alert>
                  )}

                  <Form {...apiKeyForm}>
                    <form onSubmit={apiKeyForm.handleSubmit(onSubmitApiKey)} className="space-y-4">
                      <FormField
                        control={apiKeyForm.control}
                        name="apiKey"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>OpenAI API Key</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="sk-..." 
                                type="password"
                                {...field} 
                              />
                            </FormControl>
                            <FormDescription>
                              Enter your OpenAI API key. This will be used for all AI features including medical note generation and the AI assistant.
                              You can get your API key from the <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">OpenAI Platform</a>.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex space-x-2">
                        <Button 
                          type="submit" 
                          disabled={saveApiKeyMutation.isPending || !apiKeyForm.formState.isDirty}
                        >
                          {saveApiKeyMutation.isPending ? "Saving..." : apiKeyData?.hasApiKey ? "Update API Key" : "Save API Key"}
                        </Button>
                        
                        {apiKeyData?.hasApiKey && (
                          <Button 
                            type="button" 
                            variant="destructive" 
                            onClick={handleDeleteApiKey}
                            disabled={deleteApiKeyMutation.isPending}
                          >
                            {deleteApiKeyMutation.isPending ? "Removing..." : "Remove API Key"}
                          </Button>
                        )}
                      </div>
                    </form>
                  </Form>

                  <div className="text-sm text-muted-foreground">
                    <h4 className="font-medium mb-2">Important Notes:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Your API key is stored securely and encrypted</li>
                      <li>Only you can see or modify your personal API key</li>
                      <li>API usage will be charged to your OpenAI account</li>
                      <li>If no personal API key is set, the system will use the global API key (if available)</li>
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}