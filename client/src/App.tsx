import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import PatientJoin from "@/pages/patient-join";
import Billing from "@/pages/billing";
import Assistant from "@/pages/assistant";
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
      <Route path="/billing" component={Billing} />
      <Route path="/telemedicine" component={HomePage} />
      <Route path="/settings" component={HomePage} />
      <Route path="/assistant" component={Assistant} />
      <Route path="/patient-join" component={PatientJoin} />
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
