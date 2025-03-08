import { useQuery } from "@tanstack/react-query";
import StatsCard from "@/components/dashboard/stats-card";
import AppointmentsList from "@/components/dashboard/appointments-list";
import { Calendar, Users, Clock, Stethoscope } from "lucide-react";

export default function Dashboard() {
  const { data: appointments } = useQuery<any[]>({
    queryKey: ["/api/appointments"],
  });

  const { data: patients } = useQuery<any[]>({
    queryKey: ["/api/patients"],
  });

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Patients"
          value={patients?.length || 0}
          icon={Users}
          trend={+5}
        />
        <StatsCard
          title="Appointments Today"
          value={appointments?.filter(a => new Date(a.date).toDateString() === new Date().toDateString()).length || 0}
          icon={Calendar}
          trend={+2}
        />
        <StatsCard
          title="Upcoming"
          value={appointments?.filter(a => new Date(a.date) > new Date()).length || 0}
          icon={Clock}
          trend={0}
        />
        <StatsCard
          title="Completed"
          value={appointments?.filter(a => a.status === "completed").length || 0}
          icon={Stethoscope}
          trend={+3}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <AppointmentsList appointments={appointments || []} />
      </div>
    </div>
  );
}
