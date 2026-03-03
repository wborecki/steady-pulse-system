import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AppSidebar } from "@/components/monitoring/AppSidebar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useRealtimeSubscriptions } from "@/hooks/useRealtimeSubscriptions";
import Index from "./pages/Index";
import Services from "./pages/Services";
import ServiceDetail from "./pages/ServiceDetail";
import Alerts from "./pages/Alerts";
import Reports from "./pages/Reports";
import SettingsPage from "./pages/SettingsPage";
import Documentation from "./pages/Documentation";
import Connections from "./pages/Connections";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function RealtimeProvider({ children }: { children: React.ReactNode }) {
  useRealtimeSubscriptions();
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
                    <AppSidebar>
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
                    </AppSidebar>
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
