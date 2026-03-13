import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { BuildProvider } from "@/lib/buildConfig";
import { checkForUpdate } from "@/lib/auto-update";
import Index from "./pages/Index";
import Install from "./pages/Install";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import Features from "./pages/Features";
import CharacterRoster from "./pages/CharacterRoster";
import AICreationAssistant from "./pages/AICreationAssistant";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    checkForUpdate(true);
    const interval = setInterval(() => checkForUpdate(), 5 * 60 * 1000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkForUpdate(true);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <BuildProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/roster" element={<CharacterRoster />} />
            <Route path="/features" element={<Features />} />
            <Route path="/ai-create" element={<AICreationAssistant />} />
            
            <Route path="/install" element={<Install />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </BuildProvider>
  </QueryClientProvider>
);

export default App;
