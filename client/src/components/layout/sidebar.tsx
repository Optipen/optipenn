import { Link, useLocation } from "wouter";
import { Home, Users, FileText, BarChart } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Sidebar() {
  const [location] = useLocation();

  const navItems = [
    { path: "/", label: "Tableau de bord", icon: Home },
    { path: "/clients", label: "Clients", icon: Users },
    { path: "/quotes", label: "Devis", icon: FileText },
    { path: "/statistics", label: "Statistiques", icon: BarChart },
  ];

  return (
    <div className="w-64 bg-white border-r border-slate-200 flex flex-col" data-testid="sidebar">
      <div className="p-6 border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-900" data-testid="app-title">
          Gestion Devis
        </h1>
        <p className="text-sm text-slate-500 mt-1">Suivi des relances</p>
      </div>
      
      <nav className="flex-1 p-4 space-y-2" data-testid="navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;
          
          return (
            <Link
              key={item.path}
              href={item.path}
              className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors",
                isActive
                  ? "text-blue-600 bg-blue-50 font-medium"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              )}
              data-testid={`nav-${item.path.replace("/", "") || "dashboard"}`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <span className="text-blue-600 text-sm font-medium">A</span>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">Admin</p>
            <p className="text-xs text-slate-500">admin@company.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}
