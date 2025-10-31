import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function DeclineAppointment() {
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [appointment, setAppointment] = useState<any>(null);

  useEffect(() => {
    const declineAppointment = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');

      if (!token) {
        setError("Invalid decline link");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/public/decline-appointment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (data.success) {
          setSuccess(true);
          setMessage(data.message);
          setAppointment(data.appointment);
        } else {
          setError(data.message);
        }
      } catch (err: any) {
        setError(err.message || "Failed to decline appointment");
      } finally {
        setLoading(false);
      }
    };

    declineAppointment();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Appointment Declined</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && (
            <div className="flex flex-col items-center space-y-4 py-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Processing your response...</p>
            </div>
          )}

          {!loading && success && (
            <div className="flex flex-col items-center space-y-4 py-8">
              <CheckCircle2 className="h-16 w-16 text-orange-500" />
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold text-orange-600">Appointment Declined</h3>
                <p className="text-muted-foreground">{message}</p>
                {appointment && (
                  <div className="mt-4 p-4 bg-muted rounded-lg text-left space-y-1">
                    <p><strong>Date:</strong> {new Date(appointment.date).toLocaleDateString('en-US')}</p>
                    <p><strong>Time:</strong> {new Date(appointment.date).toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: true})}</p>
                    {appointment.reason && <p><strong>Reason:</strong> {appointment.reason}</p>}
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground text-center">
                The office has been notified. They may contact you to reschedule. You can close this page now.
              </p>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center space-y-4 py-8">
              <XCircle className="h-16 w-16 text-destructive" />
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold text-destructive">Unable to Process</h3>
                <p className="text-muted-foreground">{error}</p>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                If you need assistance, please contact the office directly.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
