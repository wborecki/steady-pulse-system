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
import { PageLoader } from "@/components/PageLoader";
import Login from "./pages/Login";

// Auto-reload on chunk load failure (stale cache after deploy)
function lazyWithRetry(importFn: () => Promise<{ default: React.ComponentType }>) {
  return lazy(() =>
    importFn().catch(() => {
      // If chunk fails, hard-reload once to get fresh HTML with new hashes
      const reloaded = sessionStorage.getItem('chunk-reload');
      if (!reloaded) {
        sessionStorage.setItem('chunk-reload', '1');
        window.location.reload();
      }
      // Clear flag on success after reload
      sessionStorage.removeItem('chunk-reload');
      return importFn();
    })
  );
}

// Lazy-loaded pages — each chunk is loaded on demand (P5: code splitting)
const Index = lazyWithRetry(() => import("./pages/Index"));
const Services = lazyWithRetry(() => import("./pages/Services"));
const ServiceDetail = lazyWithRetry(() => import("./pages/ServiceDetail"));
const Alerts = lazyWithRetry(() => import("./pages/Alerts"));
const Reports = lazyWithRetry(() => import("./pages/Reports"));
const SettingsPage = lazyWithRetry(() => import("./pages/SettingsPage"));
const Documentation = lazyWithRetry(() => import("./pages/Documentation"));
const Connections = lazyWithRetry(() => import("./pages/Connections"));
const TerminalPage = lazyWithRetry(() => import("./pages/Terminal"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));

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
                        <Suspense fallback={<PageLoader />}>
                          <Routes>
                            <Route path="/" element={<Index />} />
                            <Route path="/services" element={<Services />} />
                            <Route path="/service/:id" element={<ServiceDetail />} />
                            <Route path="/alerts" element={<Alerts />} />
                            <Route path="/reports" element={<Reports />} />
                            <Route path="/settings" element={<SettingsPage />} />
                            <Route path="/connections" element={<Connections />} />
                            <Route path="/terminal" element={<TerminalPage />} />
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
