
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
  Bot
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Patients", href: "/patients", icon: Users },
  { name: "Appointments", href: "/appointments", icon: Calendar },
  { name: "Medical Notes", href: "/notes", icon: FileText },
  { name: "Telemedicine", href: "/telemedicine", icon: Video },
  { name: "AI Assistant", href: "/assistant", icon: Bot },
  { name: "Billing", href: "/billing", icon: CreditCard },
  { name: "Analytics", href: "/analytics", icon: LineChart },
  { name: "Settings", href: "/settings", icon: Settings },
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
                  "bg-primary text-primary-foreground": isActive,
                })}
              >
                <item.icon className="h-5 w-5" />
                {!isCollapsed && item.name}
              </Button>
            </Link>
          </TooltipTrigger>
          {isCollapsed && <TooltipContent side="right">{item.name}</TooltipContent>}
        </Tooltip>
      </TooltipProvider>
    );
  };

  const SidebarContent = () => (
    <>
      <div className="flex items-center justify-between px-3 h-16">
        <Link href="/dashboard">
          <div className="flex items-center gap-2 cursor-pointer">
            <Stethoscope className="h-6 w-6 text-primary" />
            {!isCollapsed && <span className="font-bold text-lg">Medical Platform</span>}
          </div>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="hidden lg:flex"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <div className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => (
          <SidebarLink key={item.name} item={item} isCollapsed={isCollapsed} />
        ))}
      </div>

      <div className={cn("px-3 py-4 border-t", { "text-center": isCollapsed })}>
        <div className="flex items-center gap-3 mb-4">
          <Avatar>
            <AvatarFallback>{user?.name[0]}</AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div>
              <p className="font-medium">{user?.name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          )}
        </div>
        <Button
          variant="outline"
          className={cn("w-full justify-start gap-2", {
            "justify-center": isCollapsed,
          })}
          onClick={() => logoutMutation.mutate()}
        >
          <LogOut className="h-5 w-5" />
          {!isCollapsed && "Logout"}
        </Button>
      </div>
    </>
  );

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild className="lg:hidden fixed top-4 left-4">
          <Button variant="outline" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      <div className={cn("hidden lg:flex flex-col border-r bg-card transition-all duration-300", {
        "w-64": !isCollapsed,
        "w-16": isCollapsed,
      })}>
        <SidebarContent />
      </div>
    </>
  );
}
