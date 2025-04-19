import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import Dashboard from "@/pages/dashboard";
import Patients from "@/pages/patients";
import Appointments from "@/pages/appointments";
import Notes from "@/pages/notes";
import Analytics from "@/pages/analytics";
import Billing from "@/pages/billing";
import Telemedicine from "@/pages/telemedicine";
import { AuthProvider } from "@/hooks/use-auth";

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/dashboard" component={HomePage} />
      <Route path="/patients" component={HomePage} />
      <Route path="/appointments" component={HomePage} />
      <Route path="/notes" component={HomePage} />
      <Route path="/analytics" component={HomePage} />
      <Route path="/billing" component={HomePage} />
      <Route path="/telemedicine" component={HomePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
