import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Sidebar from "@/components/layout/sidebar";
import Dashboard from "@/pages/dashboard";
import Clients from "@/pages/clients";
import Quotes from "@/pages/quotes";
import Statistics from "@/pages/statistics";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import { useEffect, useState } from "react";
import { getQueryFn } from "./lib/queryClient";
import ErrorBoundary from "@/components/error-boundary";

function ProtectedRoute({ component: Component }: { component: any }) {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  useEffect(() => {
    (async () => {
      // ping a protected endpoint to test auth
      try {
        const res = await fetch("/api/statistics", { credentials: "include" });
        setAuthorized(res.status !== 401);
      } catch {
        setAuthorized(false);
      }
    })();
  }, []);
  if (authorized === null) return <div className="flex h-screen items-center justify-center">Chargement…</div>;
  if (!authorized) return <Redirect to="/login" />;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/clients" component={() => <ProtectedRoute component={Clients} />} />
      <Route path="/quotes" component={() => <ProtectedRoute component={Quotes} />} />
      <Route path="/statistics" component={() => <ProtectedRoute component={Statistics} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorBoundary>
          <div className="flex h-screen bg-slate-50">
            <Sidebar />
            <div className="flex-1 overflow-auto">
              <Router />
            </div>
          </div>
          <Toaster />
        </ErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
