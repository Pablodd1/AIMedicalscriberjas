import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CalendarIcon, FileTextIcon, FormInputIcon, MessageSquareIcon, StethoscopeIcon, FileCheckIcon, DollarSignIcon, ScrollTextIcon } from "lucide-react";

const FeatureBox = ({ 
  title, 
  description, 
  icon, 
  color = "blue"
}: { 
  title: string; 
  description: string; 
  icon: React.ReactNode;
  color?: "blue" | "purple" | "teal" | "pink" | "orange" | "red";
}) => {
  const colors = {
    blue: "bg-blue-950 border-blue-800 hover:border-blue-700",
    purple: "bg-purple-950 border-purple-800 hover:border-purple-700",
    teal: "bg-teal-950 border-teal-800 hover:border-teal-700",
    pink: "bg-pink-950 border-pink-800 hover:border-pink-700",
    orange: "bg-orange-950 border-orange-800 hover:border-orange-700",
    red: "bg-red-950 border-red-800 hover:border-red-700",
  };

  return (
    <div className={`flex flex-col h-full p-6 border rounded-lg ${colors[color]} transition-all`}>
      <div className="mb-4 text-center">
        <div className="inline-flex items-center justify-center p-2 bg-opacity-20 rounded-lg bg-slate-700">
          {icon}
        </div>
      </div>
      <h3 className="text-xl font-semibold text-center mb-2">{title}</h3>
      <p className="text-sm text-center text-gray-400 mb-6 flex-grow">{description}</p>
      <div className="mt-auto">
        <Button className="w-full" variant="outline">
          Try Now
        </Button>
      </div>
      <div className="flex justify-center mt-4 space-x-2">
        <span className="h-2 w-2 rounded-full bg-red-500"></span>
        <span className="h-2 w-2 rounded-full bg-yellow-500"></span>
        <span className="h-2 w-2 rounded-full bg-green-500"></span>
        <span className="h-2 w-2 rounded-full bg-blue-500"></span>
      </div>
    </div>
  );
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="container mx-auto py-6 px-4">
        <div className="flex justify-between items-center">
          <div className="text-2xl font-bold">AIMS Medical Platform</div>
          <div className="space-x-4">
            <a href="/login">
              <Button variant="outline">Login</Button>
            </a>
            <a href="/register">
              <Button>Sign Up</Button>
            </a>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto py-12 px-4">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">Advanced Intelligent Medical Solutions</h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            A comprehensive suite of AI-powered tools to enhance medical practice management, patient care, and clinical workflows
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureBox 
            title="AIMS Scheduler" 
            icon={<CalendarIcon className="h-8 w-8 text-blue-400" />}
            description="Appointment scheduling dashboard that shows upcoming, past, and canceled appointments" 
            color="blue"
          />
          
          <FeatureBox 
            title="AIM Scribe" 
            icon={<FileTextIcon className="h-8 w-8 text-pink-400" />}
            description="AI-powered medical note taking system that structures patient visits into Medical Notes and/or SOAP notes" 
            color="pink"
          />
          
          <FeatureBox 
            title="AIMS Intake Forms" 
            icon={<FormInputIcon className="h-8 w-8 text-teal-400" />}
            description="Automated patient intake forms with QR code for easy access, eliminating the need for lengthy intake forms" 
            color="teal"
          />
          
          <FeatureBox 
            title="AIM Speech Demo" 
            icon={<StethoscopeIcon className="h-8 w-8 text-purple-400" />}
            description="Real-time voice-to-text technology combined with medical research Pocket version DEMO" 
            color="purple"
          />
          
          <FeatureBox 
            title="AIMS TEAMS talk" 
            icon={<MessageSquareIcon className="h-8 w-8 text-blue-400" />}
            description="Staff meeting summary and fast delegation with templates for clear communication and documentation of decisions, action items, or assignments" 
            color="blue"
          />
          
          <FeatureBox 
            title="AIMS Insight" 
            icon={<FileCheckIcon className="h-8 w-8 text-orange-400" />}
            description="AI diagnostic tool for symptoms, lifestyle analysis, treatment suggestions, and medical advice" 
            color="orange"
          />
          
          <FeatureBox 
            title="AIMS Chatbot" 
            icon={<MessageSquareIcon className="h-8 w-8 text-green-400" />}
            description="Chatbot for doctors providing answers for complex treatments, and medical queries" 
            color="teal"
          />
          
          <FeatureBox 
            title="Advanced Medical Billing" 
            icon={<DollarSignIcon className="h-8 w-8 text-red-400" />}
            description="Pre-insurance billing analysis, claim statistics, and compliance checks" 
            color="red"
          />
          
          <FeatureBox 
            title="AIMS AttorneyMedAI" 
            icon={<ScrollTextIcon className="h-8 w-8 text-yellow-400" />}
            description="Tremendous legal documentation, treating contracts for hire, billing, and contract preparation" 
            color="orange"
          />
        </div>
      </main>
      
      <footer className="bg-slate-950 py-6 mt-12">
        <div className="container mx-auto px-4">
          <div className="text-center text-gray-400">
            <p>CONNECT WITH US TO GAIN ACCESS: 786-442-3989</p>
            <div className="flex justify-center mt-4 space-x-4">
              <span>©</span>
              <span>📱</span>
              <span>💻</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}