import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { EventProvider } from "@/contexts/EventContext";

import Auth from "./pages/Auth";
import EventSelect from "./pages/EventSelect";
import MatchScout from "./pages/MatchScout";
import PitScout from "./pages/PitScout";
import Spreadsheet from "./pages/Spreadsheet";
import Dashboard from "./pages/Dashboard";
import Alliance from "./pages/Alliance";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <EventProvider>
            <Routes>
              <Route path="/" element={<Auth />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/event-select" element={<EventSelect />} />
              <Route path="/scout" element={<MatchScout />} />
              <Route path="/pit" element={<PitScout />} />
              <Route path="/spreadsheet" element={<Spreadsheet />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/alliance" element={<Alliance />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </EventProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
