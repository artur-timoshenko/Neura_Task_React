import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { RequireRole } from "@/components/RequireRole";
import { ThemeProvider } from "next-themes";

// Entry routes stay eager (first paint); the rest are code-split.
import Auth from "./pages/Auth";
import BoardRoute from "./pages/BoardRoute";
import NotFound from "./pages/NotFound";

const UsersPage = lazy(() => import("./pages/UsersPage"));
const Settings = lazy(() => import("./pages/Settings"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const StatsPage = lazy(() => import("./pages/StatsPage"));
const TaskRoute = lazy(() => import("./pages/TaskRoute"));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage"));
const ChatsPage = lazy(() => import("./pages/ChatsPage"));
const GuidesPage = lazy(() => import("./pages/GuidesPage"));
const GuideDetailPage = lazy(() => import("./pages/GuideDetailPage"));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Share & dedup repeated identical queries (profile, settings, etc.)
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="neura-theme" disableTransitionOnChange>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<div className="min-h-screen bg-background" />}>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/" element={<RequireRole><BoardRoute /></RequireRole>} />

              <Route path="/task/:taskCode" element={<RequireRole><TaskRoute /></RequireRole>} />
              <Route path="/users" element={<RequireRole><UsersPage /></RequireRole>} />
              <Route path="/settings" element={<RequireRole><Settings /></RequireRole>} />
              <Route path="/stats" element={<RequireRole><StatsPage /></RequireRole>} />
              <Route path="/projects" element={<RequireRole><ProjectsPage /></RequireRole>} />
              <Route path="/chats" element={<RequireRole><ChatsPage /></RequireRole>} />
              <Route path="/guides" element={<RequireRole><GuidesPage /></RequireRole>} />
              <Route path="/guides/:id" element={<RequireRole><GuideDetailPage /></RequireRole>} />
              <Route path="/:boardSlug" element={<RequireRole><BoardRoute /></RequireRole>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>

          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
