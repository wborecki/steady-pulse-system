import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AppSidebar } from "@/components/monitoring/AppSidebar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RealtimeProvider } from "@/hooks/useRealtimeSubscriptions";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { lazy, Suspense } from "react";
import { toast } from "sonner";
import { useSoundAlerts } from "@/hooks/useSoundAlerts";
import Login from "./pages/Login";

// Lazy-loaded pages — each chunk is loaded on demand (P5: code splitting)
const Index = lazy(() => import("./pages/Index"));
const Services = lazy(() => import("./pages/Services"));
const ServiceDetail = lazy(() => import("./pages/ServiceDetail"));
const Alerts = lazy(() => import("./pages/Alerts"));
const Reports = lazy(() => import("./pages/Reports"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const Documentation = lazy(() => import("./pages/Documentation"));
const Connections = lazy(() => import("./pages/Connections"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      toast.error(`Erro ao carregar dados: ${error.message}`);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      toast.error(`Erro na operação: ${error.message}`);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 15_000,       // data is fresh for 15s — prevents re-fetch on component re-mount
      gcTime: 5 * 60_000,      // keep unused data in cache for 5min
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-pulse space-y-4 w-full max-w-lg px-4">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-4 bg-muted rounded w-2/3" />
        <div className="grid grid-cols-4 gap-4 mt-6">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-muted rounded-lg" />)}
        </div>
        <div className="h-64 bg-muted rounded-lg mt-4" />
      </div>
    </div>
  );
}

function SoundAlertsProvider({ children }: { children: React.ReactNode }) {
  useSoundAlerts();
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="*"
              element={
                <ProtectedRoute>
                  <RealtimeProvider>
                    <SoundAlertsProvider>
                    <AppSidebar>
                      <ErrorBoundary>
                        <Suspense fallback={<PageFallback />}>
                          <Routes>
                            <Route path="/" element={<Index />} />
                            <Route path="/services" element={<Services />} />
                            <Route path="/service/:id" element={<ServiceDetail />} />
                            <Route path="/alerts" element={<Alerts />} />
                            <Route path="/reports" element={<Reports />} />
                            <Route path="/settings" element={<SettingsPage />} />
                            <Route path="/connections" element={<Connections />} />
                            <Route path="/docs" element={<Documentation />} />
                            <Route path="*" element={<NotFound />} />
                          </Routes>
                        </Suspense>
                      </ErrorBoundary>
                    </AppSidebar>
                    </SoundAlertsProvider>
                  </RealtimeProvider>
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
