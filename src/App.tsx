import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { BuildProvider } from "@/lib/buildConfig";
import { checkForUpdate } from "@/lib/auto-update";
import Index from "./pages/Index";

const Install = lazy(() => import("./pages/Install"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const RecoverAccount = lazy(() => import("./pages/RecoverAccount"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Features = lazy(() => import("./pages/Features"));
const CharacterRoster = lazy(() => import("./pages/CharacterRoster"));
const AICreationAssistant = lazy(() => import("./pages/AICreationAssistant"));

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
          <Suspense fallback={<div className="min-h-screen bg-background" />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/roster" element={<CharacterRoster />} />
              <Route path="/features" element={<Features />} />
              <Route path="/ai-create" element={<AICreationAssistant />} />

              <Route path="/install" element={<Install />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/recover-account" element={<RecoverAccount />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </BuildProvider>
</QueryClientProvider>
  );
};

export default App;
