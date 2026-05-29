import React, { useEffect } from "react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";

export function CatalogLayout({ children }: { children?: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add("solarstore-theme");
    return () => {
      document.documentElement.classList.remove("solarstore-theme");
    };
  }, []);

  return (
    <div className="solarstore-theme min-h-screen bg-[hsl(var(--background))] flex flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
