// src/layouts/MainLayout.tsx
import { Outlet } from "react-router-dom";
import Sidebar from "@/layouts/Sidebar";
import Header from "@/layouts/Header";

export default function MainLayout() {
  return (
    <div style={{ minHeight: "100vh", background: "#f4f7ff" }}>
      {/* Fonts used across the app */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap');

        :root {
          --sbw: 272px;
          --brand-blue:   #1e3a8a;
          --brand-orange: #E8401C;
        }

        /* Smooth sidebar width transition on main */
        .main-area {
          margin-left: var(--sbw);
          transition: margin-left .22s cubic-bezier(.4,0,.2,1);
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        @media (max-width: 767px) {
          .main-area { margin-left: 0 !important; }
        }

        /* Subtle page content background */
        .page-content {
          flex: 1;
          padding: 24px 28px;
          background: #f4f7ff;
        }

        @media (max-width: 640px) {
          .page-content { padding: 16px 16px 24px; }
        }

        /* Scrollbar styling */
        * { scrollbar-width: thin; scrollbar-color: rgba(30,58,138,.15) transparent; }
        *::-webkit-scrollbar { width: 5px; height: 5px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb { background: rgba(30,58,138,.15); border-radius: 10px; }
        *::-webkit-scrollbar-thumb:hover { background: rgba(30,58,138,.28); }
      `}</style>

      <Sidebar />

      <div className="main-area">
        <Header />
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}