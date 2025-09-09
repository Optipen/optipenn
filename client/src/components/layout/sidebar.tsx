import { Link, useLocation } from "wouter";
import { Home, Users, FileText, BarChart, Settings, LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState } from "react";

const navItems = [
  { path: "/", label: "Tableau de bord", icon: Home },
  { path: "/clients", label: "Clients", icon: Users },
  { path: "/quotes", label: "Devis", icon: FileText },
  { path: "/statistics", label: "Statistiques", icon: BarChart },
];

function ModernSidebarContent() {
  const [location] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar 
      className="bg-gradient-to-b from-slate-900 to-slate-800 border-r border-slate-700"
      data-testid="sidebar" 
      data-tour="sidebar"
      collapsible="icon"
    >
      <SidebarHeader className="p-6 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className={cn("transition-all duration-200", isCollapsed && "opacity-0")}>
            <h1 className="text-xl font-bold text-white" data-testid="app-title">
              Optipenn CRM
            </h1>
            <p className="text-sm text-slate-300 mt-1">Gestion intelligente</p>
          </div>
          {!isCollapsed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className="text-slate-300 hover:text-white hover:bg-slate-700 h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>
        {isCollapsed && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className="text-slate-300 hover:text-white hover:bg-slate-700 h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </SidebarHeader>
      
      <SidebarContent className="flex-1 p-4">
        <SidebarMenu>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            
            return (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  asChild
                  className={cn(
                    "w-full transition-all duration-200 hover:bg-slate-700 rounded-lg",
                    isActive
                      ? "bg-blue-600 text-white font-medium shadow-lg"
                      : "text-slate-300 hover:text-white"
                  )}
                  data-testid={`nav-${item.path.replace("/", "") || "dashboard"}`}
                >
                  <Link href={item.path}>
                    <Icon className="w-5 h-5 min-w-5" />
                    {!isCollapsed && <span className="ml-3">{item.label}</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      
      <SidebarFooter className="p-4 border-t border-slate-700">
        <div className="flex items-center space-x-3">
          <Avatar className="h-8 w-8 bg-gradient-to-r from-blue-500 to-purple-600">
            <AvatarFallback className="bg-transparent text-white text-sm font-medium">
              A
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">Admin</p>
              <p className="text-xs text-slate-300 truncate">admin@company.com</p>
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-slate-300 hover:text-white hover:bg-slate-700 h-8 w-8 p-0"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Paramètres</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Déconnexion</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function ModernSidebarWrapper() {
  return (
    <SidebarProvider>
      <ModernSidebarContent />
    </SidebarProvider>
  );
}
