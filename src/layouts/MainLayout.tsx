import { Outlet } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />

      {/* zone principale (padding-left géré par Sidebar via data attr) */}
      <div className="md:pl-[280px]">
        <Header />

        <main className="px-4 py-4 md:px-8 md:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
