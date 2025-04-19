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

type EmailSettingsFormValues = z.infer<typeof emailSettingsSchema>;
type EmailTemplateFormValues = z.infer<typeof emailTemplateSchema>;

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

  // Submit handlers
  const onSubmitEmailSettings = (data: EmailSettingsFormValues) => {
    saveEmailSettingsMutation.mutate(data);
  };

  const onSubmitEmailTemplates = (data: EmailTemplateFormValues) => {
    saveEmailTemplatesMutation.mutate(data);
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
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="general">Email Configuration</TabsTrigger>
          <TabsTrigger value="templates">Email Templates</TabsTrigger>
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
      </Tabs>
    </div>
  );
}