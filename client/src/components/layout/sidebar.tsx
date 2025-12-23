import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  Calendar,
  LogOut,
  Menu,
  Stethoscope,
  FileText,
  LineChart,
  CreditCard,
  Video,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bot,
  PenTool,
  ClipboardList,
  Activity,
  Shield,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Main navigation - grouped by category for better UX
const navigation = [
  // Core - Always visible first
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, category: "core" },
  
  // Patient Management
  { name: "Patients", href: "/patients", icon: Users, category: "patients" },
  { name: "Patient Intake", href: "/patient-intake", icon: ClipboardList, category: "patients" },
  { name: "Appointments", href: "/appointments", icon: Calendar, category: "patients" },
  
  // Clinical Documentation
  { name: "Medical Notes", href: "/notes", icon: FileText, category: "clinical" },
  { name: "Quick Notes", href: "/quick-notes", icon: PenTool, category: "clinical" },
  
  // Consultations
  { name: "Telemedicine", href: "/telemedicine", icon: Video, category: "consult" },
  { name: "Patient Monitoring", href: "/monitoring", icon: Activity, category: "consult" },
  
  // AI & Tools
  { name: "Lab Interpreter", href: "/lab-interpreter", icon: Stethoscope, category: "tools" },
  { name: "Doctor Helper Smart", href: "/assistant", icon: Bot, category: "tools" },
  
  // Business
  { name: "Billing", href: "/billing", icon: CreditCard, category: "business" },
  { name: "Analytics", href: "/analytics", icon: LineChart, category: "business" },
  
  // System
  { name: "Settings", href: "/settings", icon: Settings, category: "system" },
];

// Admin-only navigation items
const adminNavigation = [
  { name: "Admin Panel", href: "/admin", icon: Shield, adminOnly: true },
  { name: "Global Prompts", href: "/admin/prompts", icon: FileText, adminOnly: true },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const [open, setOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  interface NavItem {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
  }

  interface SidebarLinkProps {
    item: NavItem;
    isCollapsed: boolean;
  }

  const SidebarLink = ({ item, isCollapsed }: SidebarLinkProps) => {
    const isActive = location === item.href;

    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href={item.href}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className={cn("w-full justify-start gap-2", {
                  "bg-medical-dark-blue text-white": isActive,
                  "hover:bg-medical-yellow hover:text-black": !isActive,
                })}
              >
                <item.icon className={cn("h-5 w-5", {
                  "text-medical-yellow": isActive && (item.name === "Billing" || item.name === "Patient Monitoring"),
                  "text-medical-red": isActive && item.name === "Telemedicine",
                })} />
                {!isCollapsed && item.name}
              </Button>
            </Link>
          </TooltipTrigger>
          {isCollapsed && (
            <TooltipContent side="right">{item.name}</TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  };

  const SidebarContent = () => (
    <>
      <div className="flex items-center justify-between px-3 h-16 bg-medical-dark-blue text-white">
        <Link href="/dashboard">
          <div className="flex items-center gap-2 cursor-pointer">
            <img
              src="https://res.cloudinary.com/dsex1a9tu/image/upload/v1745207658/logo_1_cdaq2f.png"
              alt="AIMS Logo"
              className="h-6 w-6 bg-white rounded-full p-1"
            />
            {!isCollapsed && <span className="font-bold text-lg">AIMS</span>}
          </div>
        </Link>

        <Button
          variant="ghost"
          size="icon"
          className="hidden lg:flex text-white hover:bg-medical-yellow hover:text-black"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => (
          <SidebarLink key={item.name} item={item} isCollapsed={isCollapsed} />
        ))}
        
        {/* Admin-only navigation items */}
        {user?.role === 'admin' && (
          <>
            <div className={cn("my-2 border-t border-muted", { "mx-2": !isCollapsed })} />
            {adminNavigation.map((item) => (
              <SidebarLink key={item.name} item={item} isCollapsed={isCollapsed} />
            ))}
          </>
        )}
      </div>

      <div className={cn("px-3 py-4 border-t", { "text-center": isCollapsed })}>
        <div className="flex items-center gap-3 mb-4">
          <Avatar className="border-2 border-medical-yellow">
            <AvatarFallback className="bg-medical-dark-blue text-white">{user?.name?.[0]}</AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div>
              <p className="font-medium">{user?.name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          )}
        </div>
        <a href="/api/logout" style={{ width: "100%" }}>
          <Button
            variant="outline"
            className={cn("w-full justify-start gap-2 bg-medical-red hover:bg-medical-red/90 text-white border-medical-red", {
              "justify-center": isCollapsed,
            })}
          >
            <LogOut className="h-5 w-5" />
            {!isCollapsed && "Logout"}
          </Button>
        </a>
      </div>
    </>
  );

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild className="lg:hidden fixed top-4 left-4">
          <Button variant="outline" size="icon" className="bg-medical-dark-blue text-white border-medical-dark-blue hover:bg-medical-yellow hover:text-black hover:border-medical-yellow">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0 border-medical-dark-blue">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      <div
        className={cn(
          "hidden lg:flex flex-col border-r border-medical-dark-blue bg-card transition-all duration-300",
          {
            "w-64": !isCollapsed,
            "w-16": isCollapsed,
          },
        )}
      >
        <SidebarContent />
      </div>
    </>
  );
}
