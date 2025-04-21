import { useQuery } from "@tanstack/react-query";
import { Patient, Appointment, User } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { Calendar, Users, Clock, Stethoscope, Activity } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Dashboard() {
  const { user } = useAuth();

  const { data: appointments } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
  });

  const { data: patients } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
  });

  const todayAppointments = appointments?.filter(a => 
    new Date(a.date).toDateString() === new Date().toDateString()
  ) || [];

  const stats = [
    {
      title: "Total Patients",
      value: patients?.length || 0,
      icon: Users,
      trend: "+5%",
      description: "from last month"
    },
    {
      title: "Today's Appointments",
      value: todayAppointments.length,
      icon: Calendar,
      trend: "+2%",
      description: "from yesterday"
    },
    {
      title: "Upcoming Consultations",
      value: appointments?.filter(a => new Date(a.date) > new Date()).length || 0,
      icon: Clock,
      trend: "0%",
      description: "no change"
    },
    {
      title: "Patient Recovery Rate",
      value: "92%",
      icon: Activity,
      trend: "+3%",
      description: "from last quarter"
    }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {user?.name}!</h1>
        <p className="text-muted-foreground mt-1">Here's what's happening with your practice today.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                <span className={stat.trend.startsWith("+") ? "text-green-500" : "text-muted-foreground"}>
                  {stat.trend}
                </span>
                {" "}{stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Today's Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {todayAppointments.map((appointment) => {
                  const patient = patients?.find(p => p.id === appointment.patientId);
                  return (
                    <div key={appointment.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <Avatar>
                          <AvatarFallback>{patient?.firstName ? patient.firstName.charAt(0) : ''}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{patient ? `${patient.firstName} ${patient.lastName || ''}` : 'Unknown Patient'}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(appointment.date), "h:mm a")}
                          </p>
                        </div>
                      </div>
                      <Badge>{appointment.status}</Badge>
                    </div>
                  );
                })}
                {todayAppointments.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No appointments scheduled for today
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activities</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {[
                  { title: "New patient registered", time: "10 minutes ago" },
                  { title: "Completed consultation with Jane Smith", time: "1 hour ago" },
                  { title: "Updated medical records", time: "2 hours ago" },
                  { title: "Generated AI-powered consultation notes", time: "3 hours ago" },
                  { title: "Scheduled follow-up appointment", time: "4 hours ago" }
                ].map((activity, i) => (
                  <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{activity.title}</p>
                      <p className="text-sm text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}