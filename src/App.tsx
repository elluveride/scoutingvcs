import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { EventProvider } from "@/contexts/EventContext";
import { AllianceProvider } from "@/contexts/AllianceContext";
import { ServerModeProvider } from "@/contexts/ServerModeContext";
import { AnimatedRoutes } from "@/components/layout/AnimatedRoutes";
import { OfflineIndicator } from "@/components/layout/OfflineIndicator";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <EventProvider>
              <AllianceProvider>
                <ServerModeProvider>
                  <AnimatedRoutes />
                  <OfflineIndicator />
                </ServerModeProvider>
              </AllianceProvider>
            </EventProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
