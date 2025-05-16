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
import AuthPage from "@/pages/auth-page";
import { ProtectedRoute } from "@/lib/protected-route";
import LandingPage from "@/pages/landing-page";

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
import MonitoringSystem from "@/pages/monitoring";
import LabInterpreter from "@/pages/lab-interpreter";
import AdminPanel from "@/pages/admin-panel";

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

const MonitoringPage = () => (
  <MainLayout>
    <MonitoringSystem />
  </MainLayout>
);

const LabInterpreterPage = () => (
  <MainLayout>
    <LabInterpreter />
  </MainLayout>
);

function Router() {
  return (
    <Switch>
      {/* Landing page as root */}
      <Route path="/" component={LandingPage} />
      
      {/* Protected Routes - require authentication */}
      <ProtectedRoute path="/dashboard" component={DashboardPage} />
      <ProtectedRoute path="/patients" component={PatientsPage} />
      <ProtectedRoute path="/appointments" component={AppointmentsPage} />
      <ProtectedRoute path="/notes" component={NotesPage} />
      <ProtectedRoute path="/quick-notes" component={QuickNotesPage} />
      <ProtectedRoute path="/telemedicine" component={TelemedicinePage} />
      <ProtectedRoute path="/assistant" component={AssistantPage} />
      <ProtectedRoute path="/billing" component={BillingPage} />
      <ProtectedRoute path="/analytics" component={AnalyticsPage} />
      <ProtectedRoute path="/settings" component={SettingsPage} />
      <ProtectedRoute path="/patient-intake" component={PatientIntakePage} />
      <ProtectedRoute path="/monitoring" component={MonitoringPage} />
      <ProtectedRoute path="/lab-interpreter" component={LabInterpreterPage} />
      <Route path="/admin" component={AdminPanel} />
      
      {/* Public Routes - accessible without authentication */}
      <Route path="/login" component={AuthPage} />
      <Route path="/register" component={AuthPage} />
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
