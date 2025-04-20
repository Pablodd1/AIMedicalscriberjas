import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import PatientJoin from "@/pages/patient-join";
import MainLayout from "@/components/layout/main-layout";
import Assistant from "@/pages/assistant";
import { AuthProvider } from "@/hooks/use-auth";
import JoinConsultation from "@/pages/join-consultation";
import ConsultationComplete from "@/pages/consultation-complete";

// Import all the page components we need
import Dashboard from "@/pages/dashboard";
import Patients from "@/pages/patients";
import Appointments from "@/pages/appointments";
import Notes from "@/pages/notes";
import QuickNotes from "@/pages/quick-notes";
import Analytics from "@/pages/analytics";
import Telemedicine from "@/pages/telemedicine";
import Settings from "@/pages/settings";
import Billing from "@/pages/billing";
import PatientIntake from "@/pages/patient-intake";

// Wrapper components for each page with the MainLayout
const DashboardPage = () => (
  <MainLayout>
    <Dashboard />
  </MainLayout>
);

const PatientsPage = () => (
  <MainLayout>
    <Patients />
  </MainLayout>
);

const AppointmentsPage = () => (
  <MainLayout>
    <Appointments />
  </MainLayout>
);

const NotesPage = () => (
  <MainLayout>
    <Notes />
  </MainLayout>
);

const QuickNotesPage = () => (
  <MainLayout>
    <QuickNotes />
  </MainLayout>
);

const AnalyticsPage = () => (
  <MainLayout>
    <Analytics />
  </MainLayout>
);

const BillingPage = () => (
  <MainLayout>
    <Billing />
  </MainLayout>
);

const TelemedicinePage = () => (
  <MainLayout>
    <Telemedicine />
  </MainLayout>
);

const SettingsPage = () => (
  <MainLayout>
    <Settings />
  </MainLayout>
);

const AssistantPage = () => (
  <MainLayout>
    <Assistant />
  </MainLayout>
);

const PatientIntakePage = () => (
  <MainLayout>
    <PatientIntake />
  </MainLayout>
);

function Router() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/patients" component={PatientsPage} />
      <Route path="/appointments" component={AppointmentsPage} />
      <Route path="/notes" component={NotesPage} />
      <Route path="/quick-notes" component={QuickNotesPage} />
      <Route path="/telemedicine" component={TelemedicinePage} />
      <Route path="/assistant" component={AssistantPage} />
      <Route path="/billing" component={BillingPage} />
      <Route path="/analytics" component={AnalyticsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/patient-intake" component={PatientIntakePage} />
      <Route path="/patient-join/:uniqueLink" component={PatientJoin} />
      {/* Public routes for telemedicine patient access */}
      <Route path="/join-consultation/:roomId" component={JoinConsultation} />
      <Route path="/consultation-complete" component={ConsultationComplete} />
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
