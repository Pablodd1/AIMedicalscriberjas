import { useAuth } from "@/hooks/use-auth";
import Dashboard from "@/pages/dashboard";
import MainLayout from "@/components/layout/main-layout";

// HomePage now just redirects to Dashboard since we've moved the layout logic to App.tsx
export default function HomePage() {
  const { user } = useAuth();

  return (
    <MainLayout>
      <Dashboard />
    </MainLayout>
  );
}