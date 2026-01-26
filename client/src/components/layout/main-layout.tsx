import Sidebar from "@/components/layout/sidebar";
import { UploadStatusIndicator } from "@/components/upload-status-indicator";
import { GlobalRecordingBar } from "@/components/global-recording-bar";
import { VoiceCommandControl } from "@/components/voice-command-control";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="border-b bg-background px-8 py-4 flex items-center justify-between">
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            <VoiceCommandControl />
            <UploadStatusIndicator />
          </div>
        </header>
        <main className="flex-1 p-8 overflow-auto">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
      <GlobalRecordingBar />
    </div>
  );
}