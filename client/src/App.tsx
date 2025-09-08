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
import CsrfDemo from "@/pages/csrf-demo";
import GlobalSearch from "@/components/ui/global-search";
import NotificationCenter from "@/components/ui/notification-center";
import OnboardingTour, { useOnboardingTour } from "@/components/ui/onboarding-tour";
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
      <Route path="/csrf-demo" component={() => <ProtectedRoute component={CsrfDemo} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const { shouldShowTour, markTourCompleted } = useOnboardingTour();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorBoundary>
          <div className="flex h-screen bg-slate-50">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Header avec recherche globale et notifications */}
              <header className="bg-white border-b border-slate-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 max-w-md" data-tour="global-search">
                    <GlobalSearch />
                  </div>
                  <div className="flex items-center gap-4">
                    <NotificationCenter />
                  </div>
                </div>
              </header>
              
              {/* Contenu principal */}
              <div className="flex-1 overflow-auto">
                <Router />
              </div>
            </div>
          </div>
          
          {/* Tour guidé pour nouveaux utilisateurs */}
          {shouldShowTour && (
            <OnboardingTour
              autoStart={true}
              onComplete={markTourCompleted}
              onSkip={markTourCompleted}
            />
          )}
          
          <Toaster />
        </ErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
