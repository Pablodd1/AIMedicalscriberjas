import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/layout/sidebar";
import { Route, Switch } from "wouter";
import Dashboard from "./dashboard";
import Patients from "./patients";
import Appointments from "./appointments";
import Notes from "./notes";
import Analytics from "./analytics";
import Billing from "./billing";
import Telemedicine from "./telemedicine";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-6xl mx-auto">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/patients" component={Patients} />
            <Route path="/appointments" component={Appointments} />
            <Route path="/notes" component={Notes} />
            <Route path="/analytics" component={Analytics} />
            <Route path="/billing" component={Billing} />
            <Route path="/telemedicine" component={Telemedicine} />
          </Switch>
        </div>
      </main>
    </div>
  );
}