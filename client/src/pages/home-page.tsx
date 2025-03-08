import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/layout/sidebar";
import { Outlet, Route, Switch } from "wouter";
import Dashboard from "./dashboard";
import Patients from "./patients";
import Appointments from "./appointments";

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
          </Switch>
        </div>
      </main>
    </div>
  );
}
