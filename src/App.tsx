import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider as ColorThemeProvider } from "@/components/ThemeProvider";
import { ThemeProvider } from "@/lib/themes";
import { AuthProvider } from "@/hooks/useAuth";
import { CartProvider } from "@/hooks/useCart";
import { ThemeRouter } from "@/components/ThemeRouter";

// Import theme registry to register all themes
import "@/themes/themes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ColorThemeProvider defaultTheme="system" storageKey="solarstore-theme">
        <AuthProvider>
          <CartProvider>
            <ThemeProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <ThemeRouter />
                </BrowserRouter>
              </TooltipProvider>
            </ThemeProvider>
          </CartProvider>
        </AuthProvider>
      </ColorThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
