import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Calendar } from "lucide-react";

interface AppointmentsListProps {
  appointments: Array<{
    id: number;
    patientId: number;
    date: string;
    status: string;
    patient: { name: string; };
  }>;
}

export default function AppointmentsList({ appointments }: AppointmentsListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Upcoming Appointments</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {appointments
            .filter(a => new Date(a.date) > new Date())
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(0, 5)
            .map((appointment) => (
              <div
                key={appointment.id}
                className="flex items-center gap-4 p-4 rounded-lg border"
              >
                <Avatar>
                  <AvatarFallback>
                    {appointment.patient.name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{appointment.patient.name}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(appointment.date), "PPP p")}
                  </div>
                </div>
                <Badge variant={appointment.status === "scheduled" ? "default" : "secondary"}>
                  {appointment.status}
                </Badge>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
