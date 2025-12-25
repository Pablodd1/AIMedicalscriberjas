import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, MessageSquare, Clock, Send, Settings } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function NotificationSettings() {
  const { toast } = useToast();

  // Email Settings State
  const [emailSettings, setEmailSettings] = useState({
    senderEmail: "",
    senderName: "",
    appPassword: "",
    daily_patient_list_email_1: "",
    daily_patient_list_email_2: "",
    daily_patient_list_email_3: ""
  });

  // SMS Settings State
  const [smsSettings, setSmsSettings] = useState({
    twilio_account_sid: "",
    twilio_auth_token: "",
    twilio_phone_number: ""
  });

  // Load email settings
  const { data: existingEmailSettings } = useQuery<any>({
    queryKey: ["/api/settings/email"],
  });

  useEffect(() => {
    if (existingEmailSettings) {
      setEmailSettings(prev => ({ ...prev, ...existingEmailSettings }));
    }
  }, [existingEmailSettings]);

  // Load SMS settings
  const { data: existingSmsSettings } = useQuery<any>({
    queryKey: ["/api/settings/sms"],
  });

  useEffect(() => {
    if (existingSmsSettings) {
      setSmsSettings(prev => ({ ...prev, ...existingSmsSettings }));
    }
  }, [existingSmsSettings]);

  // Save email settings mutation
  const saveEmailMutation = useMutation({
    mutationFn: async (settings: typeof emailSettings) => {
      const res = await apiRequest("POST", "/api/settings/email", settings);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/email"] });
      toast({
        title: "Email Settings Saved",
        description: "Your email configuration has been updated successfully."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save email settings",
        variant: "destructive"
      });
    }
  });

  // Save SMS settings mutation
  const saveSMSMutation = useMutation({
    mutationFn: async (settings: typeof smsSettings) => {
      const res = await apiRequest("POST", "/api/settings/sms", settings);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/sms"] });
      toast({
        title: "SMS Settings Saved",
        description: "Your Twilio configuration has been updated successfully."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save SMS settings",
        variant: "destructive"
      });
    }
  });

  // Send test email
  const sendTestEmailMutation = useMutation({
    mutationFn: async (testEmail: string) => {
      const res = await apiRequest("POST", "/api/email/test-email", { testEmail });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Test Email Sent",
        description: "Check your inbox to verify email configuration."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send test email",
        variant: "destructive"
      });
    }
  });

  const handleSaveEmail = () => {
    saveEmailMutation.mutate(emailSettings);
  };

  const handleSaveSMS = () => {
    saveSMSMutation.mutate(smsSettings);
  };

  const handleTestEmail = () => {
    if (!emailSettings.senderEmail) {
      toast({
        title: "Error",
        description: "Please enter a test email address",
        variant: "destructive"
      });
      return;
    }
    sendTestEmailMutation.mutate(emailSettings.senderEmail);
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Notification Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure email and SMS notifications for patients and staff
        </p>
      </div>

      <Tabs defaultValue="email" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email Configuration
          </TabsTrigger>
          <TabsTrigger value="sms" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            SMS Configuration
          </TabsTrigger>
          <TabsTrigger value="scheduling" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Scheduled Emails
          </TabsTrigger>
        </TabsList>

        {/* Email Configuration Tab */}
        <TabsContent value="email" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Server Settings
              </CardTitle>
              <CardDescription>
                Configure your Gmail account for sending emails
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="senderEmail">Sender Email Address</Label>
                <Input
                  id="senderEmail"
                  type="email"
                  placeholder="yourname@gmail.com"
                  value={emailSettings.senderEmail}
                  onChange={(e) =>
                    setEmailSettings({ ...emailSettings, senderEmail: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Must be a Gmail account
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="senderName">Sender Name</Label>
                <Input
                  id="senderName"
                  placeholder="Medical Platform"
                  value={emailSettings.senderName}
                  onChange={(e) =>
                    setEmailSettings({ ...emailSettings, senderName: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="appPassword">Gmail App Password</Label>
                <Input
                  id="appPassword"
                  type="password"
                  placeholder="••••••••••••••••"
                  value={emailSettings.appPassword}
                  onChange={(e) =>
                    setEmailSettings({ ...emailSettings, appPassword: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Generate at: <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google App Passwords</a>
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button onClick={handleSaveEmail} disabled={saveEmailMutation.isPending}>
                  {saveEmailMutation.isPending ? "Saving..." : "Save Email Settings"}
                </Button>
                <Button variant="outline" onClick={handleTestEmail} disabled={sendTestEmailMutation.isPending}>
                  <Send className="h-4 w-4 mr-2" />
                  {sendTestEmailMutation.isPending ? "Sending..." : "Send Test Email"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SMS Configuration Tab */}
        <TabsContent value="sms" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Twilio SMS Settings
              </CardTitle>
              <CardDescription>
                Configure Twilio for appointment confirmations and reminders via SMS
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Settings className="h-4 w-4" />
                <AlertDescription>
                  <strong>Get Twilio credentials:</strong>
                  <ol className="list-decimal ml-4 mt-2 space-y-1">
                    <li>Sign up at <a href="https://www.twilio.com/try-twilio" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Twilio</a></li>
                    <li>Get your Account SID and Auth Token from the dashboard</li>
                    <li>Purchase a phone number</li>
                  </ol>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="twilioAccountSid">Twilio Account SID</Label>
                <Input
                  id="twilioAccountSid"
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={smsSettings.twilio_account_sid}
                  onChange={(e) =>
                    setSmsSettings({ ...smsSettings, twilio_account_sid: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="twilioAuthToken">Twilio Auth Token</Label>
                <Input
                  id="twilioAuthToken"
                  type="password"
                  placeholder="••••••••••••••••••••••••••••••••"
                  value={smsSettings.twilio_auth_token}
                  onChange={(e) =>
                    setSmsSettings({ ...smsSettings, twilio_auth_token: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="twilioPhone">Twilio Phone Number</Label>
                <Input
                  id="twilioPhone"
                  placeholder="+15551234567"
                  value={smsSettings.twilio_phone_number}
                  onChange={(e) =>
                    setSmsSettings({ ...smsSettings, twilio_phone_number: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Format: +1XXXXXXXXXX (with country code)
                </p>
              </div>

              <div className="pt-4">
                <Button onClick={handleSaveSMS} disabled={saveSMSMutation.isPending}>
                  {saveSMSMutation.isPending ? "Saving..." : "Save SMS Settings"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scheduled Emails Tab */}
        <TabsContent value="scheduling" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Daily Patient List Emails (7:00 AM)
              </CardTitle>
              <CardDescription>
                Configure up to 3 email addresses to receive daily patient schedules
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Mail className="h-4 w-4" />
                <AlertDescription>
                  <strong>Automated Schedule:</strong> The system will automatically send a comprehensive patient list every day at 7:00 AM to the configured email addresses below.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="email1">Primary Email Address</Label>
                <Input
                  id="email1"
                  type="email"
                  placeholder="doctor1@clinic.com"
                  value={emailSettings.daily_patient_list_email_1}
                  onChange={(e) =>
                    setEmailSettings({ ...emailSettings, daily_patient_list_email_1: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email2">Secondary Email Address (Optional)</Label>
                <Input
                  id="email2"
                  type="email"
                  placeholder="doctor2@clinic.com"
                  value={emailSettings.daily_patient_list_email_2}
                  onChange={(e) =>
                    setEmailSettings({ ...emailSettings, daily_patient_list_email_2: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email3">Third Email Address (Optional)</Label>
                <Input
                  id="email3"
                  type="email"
                  placeholder="admin@clinic.com"
                  value={emailSettings.daily_patient_list_email_3}
                  onChange={(e) =>
                    setEmailSettings({ ...emailSettings, daily_patient_list_email_3: e.target.value })
                  }
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                <h4 className="font-semibold text-blue-900 mb-2">📅 What's Included in Daily Emails:</h4>
                <ul className="list-disc ml-5 space-y-1 text-sm text-blue-800">
                  <li>All appointments scheduled for the day</li>
                  <li>Patient names, contact information, and appointment times</li>
                  <li>Reason for visit and appointment notes</li>
                  <li>Patient confirmation status (Confirmed / Pending / Declined)</li>
                  <li>Grouped by doctor for multi-provider practices</li>
                </ul>
              </div>

              <div className="pt-4">
                <Button onClick={handleSaveEmail} disabled={saveEmailMutation.isPending}>
                  {saveEmailMutation.isPending ? "Saving..." : "Save Scheduled Email Settings"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Appointment Reminders (9:00 AM)</CardTitle>
              <CardDescription>
                Automatically sends email + SMS reminders 24 hours before appointments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  <strong>Automatic Reminders:</strong> Every day at 9:00 AM, the system sends reminders to patients with appointments the next day.
                  <ul className="list-disc ml-5 mt-2 space-y-1">
                    <li>Email reminders (if patient email is available)</li>
                    <li>SMS reminders (if patient phone and Twilio are configured)</li>
                    <li>Includes appointment date, time, and confirmation options</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
