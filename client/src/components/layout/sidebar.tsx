import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Home, Users, FileText, BarChart, ChevronLeft, ChevronRight, Settings, LogOut, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Sidebar() {
  const [location] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isMobile = useIsMobile();

  const navItems = [
    { path: "/", label: "Tableau de bord", icon: Home },
    { path: "/clients", label: "Clients", icon: Users },
    { path: "/quotes", label: "Devis", icon: FileText },
    { path: "/statistics", label: "Statistiques", icon: BarChart },
  ];

  const sidebarWidth = isCollapsed ? "w-16" : "w-64";

  return (
    <div 
      className={cn(
        "bg-gradient-to-b from-slate-900 to-slate-800 text-white flex flex-col transition-all duration-300 ease-in-out relative",
        sidebarWidth,
        isMobile && "fixed left-0 top-0 bottom-0 z-50"
      )} 
      data-testid="sidebar" 
      data-tour="sidebar"
    >
      {/* Header */}
      <div className={cn("p-4 border-b border-slate-700", isCollapsed && "px-2")}>
        <div className="flex items-center justify-between">
          <div className={cn("flex items-center space-x-3", isCollapsed && "justify-center")}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            {!isCollapsed && (
              <div>
                <h1 className="text-lg font-bold text-white" data-testid="app-title">
                  Optipenn
                </h1>
                <p className="text-xs text-slate-300">CRM Professionnel</p>
              </div>
            )}
          </div>
          {!isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="text-slate-300 hover:text-white hover:bg-slate-700 w-6 h-6 p-0"
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </Button>
          )}
        </div>
      </div>
      
      {/* Navigation */}
      <nav className={cn("flex-1 p-3 space-y-1", isCollapsed && "px-2")} data-testid="navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;
          
          return (
            <Link
              key={item.path}
              href={item.path}
              className={cn(
                "flex items-center rounded-lg transition-all duration-200 group relative",
                isCollapsed ? "px-3 py-3 justify-center" : "px-3 py-3 space-x-3",
                isActive
                  ? "bg-blue-600 text-white shadow-lg" 
                  : "text-slate-300 hover:text-white hover:bg-slate-700"
              )}
              data-testid={`nav-${item.path.replace("/", "") || "dashboard"}`}
            >
              <Icon className={cn("w-5 h-5 flex-shrink-0", isActive && "text-white")} />
              {!isCollapsed && (
                <span className="font-medium">{item.label}</span>
              )}
              
              {/* Tooltip for collapsed state */}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
            </Link>
          );
        })}
      </nav>
      
      {/* User Profile */}
      <div className={cn("p-3 border-t border-slate-700", isCollapsed && "px-2")}>
        <div className={cn("flex items-center", isCollapsed ? "justify-center" : "space-x-3")}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-medium">A</span>
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">Admin</p>
              <p className="text-xs text-slate-400 truncate">admin@company.com</p>
            </div>
          )}
        </div>
        
        {!isCollapsed && (
          <div className="mt-3 flex space-x-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-300 hover:text-white hover:bg-slate-700 flex-1"
            >
              <Settings className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-300 hover:text-white hover:bg-slate-700 flex-1"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
