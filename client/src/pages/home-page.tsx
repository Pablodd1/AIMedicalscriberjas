import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/layout/sidebar";
import { useLocation } from "wouter";
import Dashboard from "@/pages/dashboard";
import Patients from "@/pages/patients";
import Appointments from "@/pages/appointments";
import Notes from "@/pages/notes";
import Analytics from "@/pages/analytics";
import Billing from "@/pages/billing";
import Telemedicine from "@/pages/telemedicine";
import Settings from "@/pages/settings";

export default function HomePage() {
  const { user } = useAuth();
  const [location] = useLocation();

  // Determine which component to render based on the current location
  const renderContent = () => {
    switch (location) {
      case "/":
      case "/dashboard":
        return <Dashboard />;
      case "/patients":
        return <Patients />;
      case "/appointments":
        return <Appointments />;
      case "/notes":
        return <Notes />;
      case "/analytics":
        return <Analytics />;
      case "/billing":
        return <Billing />;
      case "/telemedicine":
        return <Telemedicine />;
      case "/settings":
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-6xl mx-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}