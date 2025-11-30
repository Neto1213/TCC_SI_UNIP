import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import { LanguageProvider } from "@/context/LanguageProvider";
import { useLocation } from "react-router-dom";
import { AuthProvider } from "@/context/AuthProvider";
import { PrivateRoute } from "@/components/auth/PrivateRoute";
import { PublicOnlyRoute } from "@/components/auth/PublicOnlyRoute";
import { AccessibilityProvider } from "@/context/AccessibilityProvider";
import { AccessibilityToggle } from "@/components/AccessibilityToggle";
const queryClient = new QueryClient();

const ToggleGuard = () => {
  const location = useLocation();
  if (location.pathname === "/plano-de-estudo") return null;
  return <AccessibilityToggle />;
};

const App = () => (
  <AccessibilityProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LanguageProvider>
          <AuthProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route
                  path="/"
                  element={
                    <PrivateRoute>
                      <Dashboard />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <PrivateRoute>
                      <Dashboard />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/login"
                  element={
                    <PublicOnlyRoute>
                      <Login />
                    </PublicOnlyRoute>
                  }
                />
                <Route
                  path="/cadastro"
                  element={
                    <PublicOnlyRoute>
                      <Cadastro />
                    </PublicOnlyRoute>
                  }
                />
                <Route
                  path="/plano-de-estudo"
                  element={
                    <PrivateRoute>
                      <Index />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/plano-de-estudo/novo"
                  element={
                    <PrivateRoute>
                      <Index />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/forgot-password"
                  element={
                    <PublicOnlyRoute>
                      <ForgotPassword />
                    </PublicOnlyRoute>
                  }
                />
                <Route
                  path="/reset-password"
                  element={
                    <PublicOnlyRoute>
                      <ResetPassword />
                    </PublicOnlyRoute>
                  }
                />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              <ToggleGuard />
            </BrowserRouter>
          </AuthProvider>
        </LanguageProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </AccessibilityProvider>
);

export default App;
