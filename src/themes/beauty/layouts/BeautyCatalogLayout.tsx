import { Outlet } from "react-router-dom";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";

export function BeautyCatalogLayout() {
  return (
    <div className="beauty-theme min-h-screen bg-[hsl(var(--background))] flex flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
